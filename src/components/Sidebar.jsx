import { useEffect, useRef, useState } from "react";
import { Network, Download, Upload, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import RoleLibrary from "./RoleLibrary";
import { loadRoles, saveRoles, exportBackup, importBackup } from "../utils/storage";
import { defaultRoles } from "../data/defaultRoles";

function generateRoleId() {
  return `role-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// One row in the chart list: shows the chart name, and on hover
// reveals rename + delete controls. Renaming swaps the row for an
// inline text field instead of opening a modal, since it's a single
// short string.
function ChartListItem({ chart, isActive, canDelete, onSelect, onRename, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(chart.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startRename = () => {
    setDraftName(chart.name);
    setIsEditing(true);
  };

  const commitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== chart.name) {
      onRename(chart.id, trimmed);
    }
    setIsEditing(false);
  };

  const cancelRename = () => {
    setDraftName(chart.name);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="w-full flex items-center gap-1.5 rounded-lg px-3 py-2 bg-blue-800/60">
        <Network size={16} className="flex-shrink-0 text-blue-300" />
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") cancelRename();
          }}
          className="min-w-0 flex-1 text-sm bg-white/10 text-white rounded-md px-2 py-1 border border-blue-500 focus:outline-none focus:border-blue-300"
        />
        <button
          onClick={commitRename}
          title="Save name"
          className="flex-shrink-0 text-blue-200 hover:text-white"
        >
          <Check size={15} />
        </button>
        <button
          onClick={cancelRename}
          title="Cancel"
          className="flex-shrink-0 text-blue-200 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group w-full flex items-center gap-1.5 rounded-lg px-3 py-2 cursor-pointer ${
        isActive ? "bg-blue-700 font-semibold" : "hover:bg-blue-800/50"
      }`}
      onClick={() => onSelect(chart.id)}
    >
      <Network size={16} className="flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">{chart.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          startRename();
        }}
        title="Rename chart"
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!canDelete) return;
          if (window.confirm(`Delete "${chart.name}"? This can't be undone.`)) {
            onDelete(chart.id);
          }
        }}
        title={canDelete ? "Delete chart" : "You need at least one chart"}
        disabled={!canDelete}
        className={`flex-shrink-0 opacity-0 group-hover:opacity-100 ${
          canDelete ? "text-blue-200 hover:text-red-400" : "text-blue-800 cursor-not-allowed"
        }`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function Sidebar({
  charts,
  activeChartId,
  onSelectChart,
  onAddChart,
  onRenameChart,
  onDeleteChart,
}) {
  const [roles, setRoles] = useState(() => loadRoles(defaultRoles));
  const importInputRef = useRef(null);

  useEffect(() => {
    saveRoles(roles);
  }, [roles]);

  const handleAddRole = (fields) => {
    setRoles((prev) => [...prev, { id: generateRoleId(), ...fields }]);
  };

  const handleUpdateRole = (id, fields) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  };

  const handleDeleteRole = (id) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importBackup(file);
      // Reload so the Role Library and every chart both freshly read
      // whatever was just written to localStorage.
      window.location.reload();
    } catch (err) {
      alert("Couldn't read that backup file — make sure it's a career-architecture-backup .json file.");
    }
  };

  return (
    <aside className="w-80 bg-[#0F2B5B] text-white flex flex-col">
      <div className="p-6 border-b border-blue-800 flex-shrink-0">
        <h2 className="text-xl font-bold">Career Architecture</h2>
      </div>

      <nav className="p-4 flex-shrink-0 border-b border-blue-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-300">
            Charts
          </h3>
          <button
            onClick={onAddChart}
            title="New chart"
            className="text-blue-300 hover:text-white"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {charts.map((chart) => (
            <ChartListItem
              key={chart.id}
              chart={chart}
              isActive={chart.id === activeChartId}
              canDelete={charts.length > 1}
              onSelect={onSelectChart}
              onRename={onRenameChart}
              onDelete={onDeleteChart}
            />
          ))}
        </div>
      </nav>

      <RoleLibrary
        roles={roles}
        onAdd={handleAddRole}
        onUpdate={handleUpdateRole}
        onDelete={handleDeleteRole}
      />

      <div className="p-4 border-t border-blue-800 flex gap-2 flex-shrink-0">
        <button
          onClick={exportBackup}
          title="Download a backup of your roles and charts as a .json file"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-800/60 hover:bg-blue-800 rounded-lg px-3 py-2 font-medium"
        >
          <Download size={13} />
          Export
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          title="Restore roles and charts from a backup .json file"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-800/60 hover:bg-blue-800 rounded-lg px-3 py-2 font-medium"
        >
          <Upload size={13} />
          Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          onChange={handleImportChange}
          className="hidden"
        />
      </div>
    </aside>
  );
}
