import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "reactflow";
import { X } from "lucide-react";

// A regular reporting-line edge, plus a small "x" button that shows up
// at the midpoint once the line itself has been clicked (React Flow
// marks it `selected` for us). Clicking that button removes just this
// one connection — the two roles it linked stay exactly as they were.
export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? "#ef4444" : style?.stroke,
          strokeWidth: selected ? 2.5 : style?.strokeWidth,
        }}
        interactionWidth={20}
      />
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <button
              onClick={(event) => {
                event.stopPropagation();
                data?.onDelete?.(id);
              }}
              title="Delete this connection"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "1px solid #fecaca",
                background: "white",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,.2)",
              }}
            >
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
