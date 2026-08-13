import { Handle, Position, NodeResizer } from "reactflow";
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

// "Aptos" only actually renders for people who have it installed on
// their machine (it ships with recent Microsoft Office, it isn't a
// freely-embeddable web font) — everyone else transparently falls back
// to a close system sans-serif, so nothing ever looks broken.
const FONT_STACK = '"Aptos", "Aptos Display", "Segoe UI", ui-sans-serif, system-ui, sans-serif';

export default function CustomNode({ data, selected }) {
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
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={70}
        color="#2563eb"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />

      <Handle type="target" position={Position.Top} />

      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 10,
          overflow: "hidden",
          border,
          boxShadow,
          background: "white",
          cursor: "pointer",
          fontFamily: FONT_STACK,
          // Container queries let the text below scale with however big
          // this particular box has been resized to, instead of a fixed
          // pixel size that looks cramped when enlarged or oversized
          // when shrunk.
          containerType: "size",
          display: "flex",
          flexDirection: "column",
          opacity: isClosed ? 0.55 : 1,
          transition: "box-shadow 0.3s ease, border-color 0.3s ease, opacity 0.2s ease",
        }}
        title="Click to trace reporting line · Double-click to edit · Drag from the bottom dot to connect · Select to resize · Use the arrow to collapse/expand"
      >
        <div
          style={{
            background: isClosed ? "#94a3b8" : colourForLevel(data.level),
            color: "white",
            fontWeight: 600,
            fontSize: "clamp(11px, 12cqh, 22px)",
            padding: "clamp(6px, 8cqh, 16px) clamp(8px, 6cqw, 18px)",
            flexShrink: 0,
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
                  fontSize: "clamp(8px, 8cqh, 12px)",
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
            fontSize: "clamp(10px, 10cqh, 18px)",
            color: "#334155",
            padding: "clamp(4px, 7cqh, 14px) clamp(8px, 6cqw, 18px)",
            background: "white",
            flex: 1,
            minHeight: 0,
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
