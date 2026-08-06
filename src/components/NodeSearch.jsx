import { useEffect, useRef, useState } from "react";
import { Panel } from "reactflow";
import { Search, X } from "lucide-react";

export default function NodeSearch({ nodes, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const matches =
    trimmed.length === 0
      ? []
      : nodes
          .filter((n) => n.data.label.toLowerCase().includes(trimmed))
          .slice(0, 8);

  const handleSelect = (id) => {
    onSelect(id);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && matches.length > 0) {
      handleSelect(matches[0].id);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  };

  return (
    <Panel position="top-left" className="m-3">
      <div ref={containerRef} className="relative w-64">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name or role…"
            className="nodrag flex-1 text-sm outline-none placeholder:text-slate-400 min-w-0"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setOpen(false);
              }}
              className="text-slate-300 hover:text-slate-500 flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {open && trimmed && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
            {matches.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
            ) : (
              matches.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleSelect(n.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex flex-col"
                >
                  <span className="font-medium text-slate-700">{n.data.label}</span>
                  <span className="text-xs text-slate-400">
                    {n.data.level}
                    {n.data.experience ? ` · ${n.data.experience}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
