import { useCallback, useRef, useState } from "react";
import {
  Upload,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { readExcelFile } from "../utils/excelParser";

// Chrome/Edge can remember a real handle to the file on disk, so
// "Refresh" re-reads whatever HR just saved without asking again.
// Safari/Firefox don't support this yet, so they fall back to a plain
// file picker that has to be re-chosen after every edit.
const supportsFileSystemAccess =
  typeof window !== "undefined" && "showOpenFilePicker" in window;

export default function ExcelToolbar({ onDataLoaded }) {
  const fileInputRef = useRef(null);
  const fileHandleRef = useRef(null);

  const [fileName, setFileName] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [warningsOpen, setWarningsOpen] = useState(false);

  const applyParsedFile = useCallback(
    async (file) => {
      setIsLoading(true);
      setError(null);
      try {
        const { items, warnings: rowWarnings } = await readExcelFile(file);
        if (items.length === 0) {
          setError("No usable rows found — check the ID and Role columns.");
          return;
        }
        setFileName(file.name);
        setWarnings(rowWarnings);
        setLastSyncedAt(new Date());
        onDataLoaded(items);
      } catch (err) {
        setError("Couldn't read that file — make sure it's a valid .xlsx sheet.");
      } finally {
        setIsLoading(false);
      }
    },
    [onDataLoaded]
  );

  const handlePick = useCallback(async () => {
    setError(null);
    if (supportsFileSystemAccess) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: "Excel Sheet",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
                  ".xlsx",
                ],
              },
            },
          ],
          multiple: false,
        });
        fileHandleRef.current = handle;
        const file = await handle.getFile();
        await applyParsedFile(file);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setError("Could not open the file picker.");
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [applyParsedFile]);

  const handleRefresh = useCallback(async () => {
    setError(null);
    if (supportsFileSystemAccess && fileHandleRef.current) {
      try {
        const perm = await fileHandleRef.current.queryPermission({ mode: "read" });
        if (perm !== "granted") {
          const req = await fileHandleRef.current.requestPermission({ mode: "read" });
          if (req !== "granted") {
            setError("Permission to read the file was denied.");
            return;
          }
        }
        const file = await fileHandleRef.current.getFile();
        await applyParsedFile(file);
      } catch (err) {
        setError("Could not re-read the file — try \"Change file\" instead.");
      }
    } else {
      // Either an unsupported browser, or no file chosen yet this session.
      await handlePick();
    }
  }, [applyParsedFile, handlePick]);

  const handleFileInputChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // so picking the same filename again still fires onChange
      if (!file) return;
      await applyParsedFile(file);
    },
    [applyParsedFile]
  );

  return (
    <div className="flex-shrink-0 border-b bg-slate-50 px-4 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-slate-700 font-medium text-sm min-w-0">
          <FileSpreadsheet size={16} className="text-slate-500 flex-shrink-0" />
          <span className="truncate">{fileName ?? "No Excel sheet loaded"}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {fileName && (
            <button
              onClick={handlePick}
              className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
            >
              Change file
            </button>
          )}

          <button
            onClick={fileName ? handleRefresh : handlePick}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
          >
            {fileName ? (
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            ) : (
              <Upload size={14} />
            )}
            {fileName ? (isLoading ? "Refreshing…" : "Refresh") : "Load Excel Sheet"}
          </button>
        </div>
      </div>

      {lastSyncedAt && !error && (
        <div className="text-xs text-slate-400">
          Last synced {lastSyncedAt.toLocaleTimeString()}
          {!supportsFileSystemAccess &&
            " — use \"Change file\" after editing, since this browser can't re-read the same file automatically"}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="text-xs">
          <button
            onClick={() => setWarningsOpen((v) => !v)}
            className="flex items-center gap-1 text-amber-700 hover:text-amber-800"
          >
            <AlertTriangle size={13} />
            {warnings.length} row{warnings.length > 1 ? "s" : ""} skipped or adjusted
            {warningsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {warningsOpen && (
            <ul className="mt-1 ml-4 list-disc text-slate-500 space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}
