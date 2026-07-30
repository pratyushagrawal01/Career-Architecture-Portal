import { Handle, Position } from "reactflow";
import { ChevronRight, ChevronDown } from "lucide-react";

const colourMap = {
  N1: "#0F2B5B",
  N2: "#2F5DA8",
  L1: "#8CB9F5",
};

// Any level string HR types into the sheet that we don't already know
// (a typo, or a genuinely new grade like "L2") still needs *some*
// color rather than rendering blank — pick one deterministically so
// the same level always gets the same color across refreshes.
const FALLBACK_PALETTE = ["#5B8DEF", "#7C5CBF", "#2F9E77", "#B45309", "#BE185D"];

function colourForLevel(level) {
  if (colourMap[level]) return colourMap[level];
  if (!level) return "#64748B";
  let hash = 0;
  for (let i = 0; i < level.length; i++) {
    hash = (hash * 31 + level.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export default function CustomNode({ data }) {
  return (
    <>
      <Handle type="target" position={Position.Top} />

      <div
        style={{
          width: 240,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #dbe4f0",
          boxShadow: "0 2px 10px rgba(0,0,0,.08)",
          background: "white",
        }}
      >
        <div
          style={{
            background: colourForLevel(data.level),
            color: "white",
            padding: "10px 14px",
            fontWeight: 600,
            fontSize: 15,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ minWidth: 0 }}>{data.label}</span>

          {data.hasChildren && (
            <button
              className="nodrag nopan"
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: 0,
                flexShrink: 0,
                marginTop: 2,
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                data.onToggle?.(data.id);
              }}
            >
              {data.expanded ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 14px",
            fontSize: 13,
            color: "#555",
          }}
        >
          <span>{data.level}</span>
          <span>{data.experience}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </>
  );
}