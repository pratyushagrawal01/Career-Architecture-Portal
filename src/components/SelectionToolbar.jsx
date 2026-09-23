import { Panel } from "reactflow";
import { Lock, Unlock, Trash2, X } from "lucide-react";

// Shows up over the canvas whenever 2+ roles are selected (box-select
// by dragging on empty canvas, or shift/ctrl-click to add one at a
// time) and lets the whole group be acted on together, instead of
// opening the edit modal on each box one by one.
export default function SelectionToolbar({ count, onClose, onOpen, onDelete, onClear }) {
  if (count < 2) return null;

  return (
    <Panel position="bottom-center">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-lg text-sm text-slate-700">
        <span className="font-medium px-1">{count} selected</span>

        <button
          type="button"
          onClick={onClose}
          title="Mark all selected as closed"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100"
        >
          <Lock size={14} /> Close
        </button>

        <button
          type="button"
          onClick={onOpen}
          title="Mark all selected as open"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100"
        >
          <Unlock size={14} /> Open
        </button>

        <button
          type="button"
          onClick={onDelete}
          title="Delete all selected"
          className="flex items-center gap-1 px-2 py-1 rounded text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} /> Delete
        </button>

        <button
          type="button"
          onClick={onClear}
          title="Clear selection"
          className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-400"
        >
          <X size={14} />
        </button>
      </div>
    </Panel>
  );
}
