import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  ControlButton,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import { Maximize2, Minimize2 } from "lucide-react";

import CustomNode from "./CustomNode";
import ExcelToolbar from "./ExcelToolbar";
import { defaultTreeItems, initialCollapsedIds } from "../data/cooData";
import { computeLayout } from "../utils/treeLayout";

const nodeTypes = { custom: CustomNode };

function buildChildrenMap(items) {
  const map = {};
  items.forEach((item) => {
    if (item.parentId) {
      map[item.parentId] = map[item.parentId] || [];
      map[item.parentId].push(item.id);
    }
  });
  return map;
}

function buildParentMap(items) {
  return Object.fromEntries(items.map((item) => [item.id, item.parentId]));
}

// A node is hidden if any ancestor above it currently has its
// children collapsed (data.hasChildren && data.expanded === false).
function computeHiddenMap(nodesList, parentMap) {
  const collapsedIds = new Set(
    nodesList
      .filter((n) => n.data.hasChildren && n.data.expanded === false)
      .map((n) => n.id)
  );
  const hiddenMap = {};
  nodesList.forEach((n) => {
    let current = parentMap[n.id];
    let hidden = false;
    while (current) {
      if (collapsedIds.has(current)) {
        hidden = true;
        break;
      }
      current = parentMap[current];
    }
    hiddenMap[n.id] = hidden;
  });
  return hiddenMap;
}

// Builds a fresh nodes/edges pair from a flat tree-items list. Used both
// on first load and every time a new Excel sheet is parsed in.
// `positionsById`/`expandedById` let a refresh keep whatever the user
// had already dragged or expanded, for ids that still exist.
function buildGraph(items, { collapsedIds = new Set(), positionsById = {}, expandedById = {} } = {}) {
  const layoutPositions = computeLayout(items);
  const childrenMap = buildChildrenMap(items);
  const parentMap = buildParentMap(items);

  const nodes = items.map((item) => {
    const hasChildrenNow = Boolean(childrenMap[item.id]?.length);
    const expanded =
      item.id in expandedById ? expandedById[item.id] : !collapsedIds.has(item.id);

    return {
      id: item.id,
      type: "custom",
      position: positionsById[item.id] ?? layoutPositions[item.id] ?? { x: 0, y: 0 },
      data: {
        id: item.id,
        label: item.label,
        level: item.level,
        experience: item.experience,
        hasChildren: hasChildrenNow,
        expanded,
      },
    };
  });

  const hiddenMap = computeHiddenMap(nodes, parentMap);
  nodes.forEach((n) => {
    n.hidden = hiddenMap[n.id];
  });

  const edges = items
    .filter((item) => item.parentId)
    .map((item) => ({
      id: `e${item.parentId}-${item.id}`,
      source: item.parentId,
      target: item.id,
      hidden: hiddenMap[item.id],
    }));

  return { nodes, edges, parentMap };
}

const initialGraph = buildGraph(defaultTreeItems, {
  collapsedIds: new Set(initialCollapsedIds),
});

export default function CareerTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

  const parentMapRef = useRef(initialGraph.parentMap);
  const hiddenMapRef = useRef({});

  // Kept in sync after every render so handleExcelData (a rarely-called
  // callback) can read the latest node positions/expand state without
  // needing to change identity on every drag.
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const wrapperRef = useRef(null);
  const instanceRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () =>
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      instanceRef.current?.fitView({ padding: 0.2 });
    }, 150);
    return () => clearTimeout(t);
  }, [isFullscreen]);

  const onToggle = useCallback(
    (id) => {
      setNodes((prevNodes) => {
        const toggled = prevNodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, expanded: !n.data.expanded } }
            : n
        );
        const hiddenMap = computeHiddenMap(toggled, parentMapRef.current);
        hiddenMapRef.current = hiddenMap;
        return toggled.map((n) => ({ ...n, hidden: hiddenMap[n.id] }));
      });

      setEdges((prevEdges) =>
        prevEdges.map((e) => ({
          ...e,
          hidden: hiddenMapRef.current[e.target] ?? e.hidden,
        }))
      );
    },
    [setNodes, setEdges]
  );

  // onToggle never changes identity, so this only needs to run once to
  // attach it into each node's data. Dragging (applyNodeChanges) never
  // touches node.data, so this reference survives drags untouched.
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, onToggle } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToggle]);

  // Called by the toolbar once a new Excel file has been parsed into
  // { id, parentId, label, level, experience } rows. Rows that were
  // deleted from the sheet simply aren't in newItems, so they vanish
  // from the chart; new rows appear with an auto-computed position.
  // Existing rows keep wherever the user had dragged them, and keep
  // whatever expand/collapse state they were already in.
  const handleExcelData = useCallback(
    (newItems) => {
      const prevNodes = nodesRef.current;
      const positionsById = Object.fromEntries(prevNodes.map((n) => [n.id, n.position]));
      const expandedById = Object.fromEntries(prevNodes.map((n) => [n.id, n.data.expanded]));

      const { nodes: rebuiltNodes, edges: rebuiltEdges, parentMap } = buildGraph(newItems, {
        positionsById,
        expandedById,
      });

      parentMapRef.current = parentMap;
      hiddenMapRef.current = Object.fromEntries(rebuiltNodes.map((n) => [n.id, n.hidden]));

      setNodes(rebuiltNodes.map((n) => ({ ...n, data: { ...n.data, onToggle } })));
      setEdges(rebuiltEdges);

      setTimeout(() => instanceRef.current?.fitView({ padding: 0.2 }), 150);
    },
    [onToggle, setNodes, setEdges]
  );

  return (
    <div
      ref={wrapperRef}
      className={
        isFullscreen
          ? "h-full w-full bg-white flex flex-col"
          : "h-full w-full rounded-xl overflow-hidden border bg-white flex flex-col"
      }
    >
      <ExcelToolbar onDataLoaded={handleExcelData} />

      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={(instance) => {
            instanceRef.current = instance;
          }}
          nodesDraggable
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap />
          <Controls>
            <ControlButton
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit full screen" : "Full screen"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </ControlButton>
          </Controls>
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
