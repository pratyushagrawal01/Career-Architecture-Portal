import { useEffect, useRef, useState } from "react";
import { Type } from "lucide-react";

// Cross-platform-safe families only — nothing that needs a web font
// fetched from outside, so this keeps working offline and looks the
// same on every machine that opens the chart.
const FONT_OPTIONS = [
  { label: "Default (Inter)", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.8;

// Applies to every role box at once (via a CSS variable set on the
// chart's wrapper element in CareerTree) rather than per-node, since
// the ask was to change the font for the chart as a whole.
export default function FontControls({ fontFamily, fontScale, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Chart font settings"
        className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <Type size={14} />
        <span>Font</span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-slate-700"
          style={{ top: "100%" }}
        >
          <label className="block text-xs font-medium text-slate-500 mb-1">Font</label>
          <select
            className="w-full mb-3 rounded border border-slate-200 px-2 py-1 text-sm"
            value={fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
            <span>Text size</span>
            <span>{Math.round(fontScale * 100)}%</span>
          </label>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.05}
            value={fontScale}
            onChange={(e) => onChange({ fontScale: parseFloat(e.target.value) })}
            className="w-full"
          />

          <button
            type="button"
            onClick={() => onChange({ fontFamily: "Inter, sans-serif", fontScale: 1 })}
            className="mt-3 w-full text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
