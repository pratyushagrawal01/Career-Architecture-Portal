import { useEffect, useMemo, useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";

export default function EditNodeModal({ node, nodes, onSave, onDelete, onClose }) {
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState("");
  const [experience, setExperience] = useState("");
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!node) return;
    setLabel(node.data.label || "");
    setLevel(node.data.level || "");
    setExperience(node.data.experience || "");
    setManuallyClosed(Boolean(node.data.manuallyClosed));
    setConfirmingDelete(false);
  }, [node]);

  // Only actually computed while the modal is mounted (i.e. open), so
  // this never runs during a background drag.
  const knownLevels = useMemo(() => {
    const set = new Set(nodes.map((n) => n.data.level).filter(Boolean));
    return Array.from(set).sort();
  }, [nodes]);

  if (!node) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    onSave(node.id, {
      label: label.trim(),
      level: level.trim() || "L1",
      experience: experience.trim(),
      manuallyClosed,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Edit position</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Level</label>
              <input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                list="known-levels"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <datalist id="known-levels">
                {knownLevels.map((lvl) => (
                  <option key={lvl} value={lvl} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Experience
              </label>
              <input
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. 5 Years"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={manuallyClosed}
                onChange={(e) => setManuallyClosed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Mark this position as closed
                <span className="block text-xs text-slate-400">
                  Any position reporting only to this one — with no other open
                  parent — will show as closed too.
                </span>
              </span>
            </label>
            {!manuallyClosed && node.data.closed && (
              <p className="mt-2 text-xs text-amber-600 flex items-start gap-1.5">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                Currently showing as closed because every position it reports
                to is closed.
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Save
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100">
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
            >
              <Trash2 size={14} />
              Delete this position
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-1.5 text-sm text-slate-600">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span>
                  Delete "{node.data.label}"? Any connections to or from it will be
                  removed too.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onDelete(node.id)}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-sm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
