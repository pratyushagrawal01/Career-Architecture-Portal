import { Handle, Position } from "reactflow";
import { ChevronRight, ChevronDown } from "lucide-react";

const colourMap = {
  N1: "#0F2B5B",
  N2: "#2F5DA8",
  L1: "#8CB9F5",
};

// Any level string that isn't one of the known ones (a typo, or a
// genuinely new grade) still needs some color rather than rendering
// blank — pick one deterministically so the same level always gets
// the same color.
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
  let border = "1px solid #dbe4f0";
  let boxShadow = "0 2px 10px rgba(0,0,0,.08)";

  if (data.highlighted) {
    border = "1px solid #f59e0b";
    boxShadow = "0 0 0 4px rgba(245,158,11,0.35), 0 2px 10px rgba(0,0,0,.08)";
  } else if (data.chainHighlighted) {
    border = "1px solid #2563eb";
    boxShadow = "0 0 0 3px rgba(37,99,235,0.3), 0 2px 10px rgba(0,0,0,.08)";
  }

  // `closed` is the *effective* state — computed from this node's own
  // manual toggle plus its parents: a node only shows as closed once
  // every one of its parents (if any) is also effectively closed, so a
  // child with one open and one closed parent still reads as open.
  const isClosed = Boolean(data.closed);

  return (
    <>
      <Handle type="target" position={Position.Top} />

      <div
        style={{
          width: 240,
          borderRadius: 10,
          overflow: "hidden",
          border,
          boxShadow,
          background: "white",
          cursor: "pointer",
          opacity: isClosed ? 0.55 : 1,
          transition: "box-shadow 0.3s ease, border-color 0.3s ease, opacity 0.2s ease",
        }}
        title="Click to trace reporting line · Double-click to edit · Drag from the bottom dot to connect · Use the arrow to collapse/expand"
      >
        <div
          style={{
            background: isClosed ? "#94a3b8" : colourForLevel(data.level),
            color: "white",
            fontWeight: 600,
            fontSize: 13,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              textDecoration: isClosed ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {data.label}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {isClosed && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  background: "rgba(255,255,255,0.25)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                CLOSED
              </span>
            )}

            {data.hasChildren && (
              <button
                className="nodrag nopan"
                title={data.expanded ? "Collapse this branch" : "Expand this branch"}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  data.onToggle?.(data.id);
                }}
              >
                {data.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "#334155",
            padding: "8px 12px",
            background: "white",
          }}
        >
          <span>{data.level}</span>
          {data.experience && <span>{data.experience}</span>}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
