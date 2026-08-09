import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

export default function RoleLibrary({ roles, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState("");
  const [experience, setExperience] = useState("");

  const knownLevels = Array.from(new Set(roles.map((r) => r.level).filter(Boolean))).sort();

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLabel("");
    setLevel("");
    setExperience("");
  };

  const startEdit = (role) => {
    setEditingId(role.id);
    setLabel(role.label);
    setLevel(role.level || "");
    setExperience(role.experience || "");
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    const fields = {
      label: label.trim(),
      level: level.trim() || "L1",
      experience: experience.trim(),
    };
    if (editingId) {
      onUpdate(editingId, fields);
    } else {
      onAdd(fields);
    }
    resetForm();
  };

  return (
    <div className="p-4 border-t border-blue-800 flex-1 overflow-y-auto min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-300">
          Role Library
        </h3>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="text-blue-300 hover:text-white"
          title="Add a role"
        >
          <Plus size={16} />
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-3 bg-blue-950/50 rounded-lg p-3 space-y-2 flex-shrink-0"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Role title"
            autoFocus
            className="w-full text-sm rounded-md px-2 py-1.5 bg-white/10 placeholder-blue-300 text-white border border-blue-700 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2">
            <input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Level"
              list="role-levels"
              className="w-1/2 text-sm rounded-md px-2 py-1.5 bg-white/10 placeholder-blue-300 text-white border border-blue-700 focus:outline-none focus:border-blue-400"
            />
            <input
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Experience"
              className="w-1/2 text-sm rounded-md px-2 py-1.5 bg-white/10 placeholder-blue-300 text-white border border-blue-700 focus:outline-none focus:border-blue-400"
            />
          </div>
          <datalist id="role-levels">
            {knownLevels.map((lvl) => (
              <option key={lvl} value={lvl} />
            ))}
          </datalist>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-blue-300 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md font-medium"
            >
              {editingId ? "Save" : "Add"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-1.5 overflow-y-auto">
        {roles.length === 0 && (
          <p className="text-xs text-blue-300/70">
            No roles yet — add one above, then drag it onto the chart.
          </p>
        )}
        {roles.map((role) => (
          <div
            key={role.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-role", JSON.stringify(role));
              e.dataTransfer.effectAllowed = "move";
            }}
            className="group flex items-center gap-2 bg-blue-950/40 hover:bg-blue-950/70 rounded-lg px-2.5 py-2 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} className="text-blue-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{role.label}</div>
              <div className="text-[11px] text-blue-300">
                {role.level}
                {role.experience ? ` · ${role.experience}` : ""}
              </div>
            </div>
            <button
              onClick={() => startEdit(role)}
              className="opacity-0 group-hover:opacity-100 text-blue-300 hover:text-white flex-shrink-0"
              title="Edit role"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(role.id)}
              className="opacity-0 group-hover:opacity-100 text-blue-300 hover:text-red-400 flex-shrink-0"
              title="Delete role"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-blue-400/70 mt-3 flex-shrink-0">
        Drag a role onto the chart to place it — the same role can be placed as many
        times as you like, and each placed copy can be edited on its own afterward.
      </p>
    </div>
  );
}
