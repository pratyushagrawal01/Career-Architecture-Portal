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
import * as XLSX from "xlsx";

import CustomNode from "./CustomNode";
import ExcelToolbar from "./ExcelToolbar";
import NodeSearch from "./NodeSearch";
import EditNodeModal from "./EditNodeModal";
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

// Recomputes each node's hasChildren flag from the current parentMap —
// used after any structural edit (reparent/delete/add) where the set
// of children under a given node may have changed.
function withHasChildren(nodesList, parentMap) {
  const childrenCount = {};
  nodesList.forEach((n) => {
    const p = parentMap[n.id];
    if (p) childrenCount[p] = (childrenCount[p] || 0) + 1;
  });
  return nodesList.map((n) => ({
    ...n,
    data: { ...n.data, hasChildren: Boolean(childrenCount[n.id]) },
  }));
}

// The clicked node plus every ancestor up to the top of the chart —
// this is exactly what gets the blue "reporting chain" highlight.
function computeChainIds(id, parentMap) {
  const ids = new Set([id]);
  let current = parentMap[id];
  while (current) {
    ids.add(current);
    current = parentMap[current];
  }
  return ids;
}

// Picks a fresh Sr No. for a newly-added position: one past the
// highest existing numeric ID, so it reads naturally next to
// whatever HR's sheet already uses.
function nextId(existingIds) {
  const numeric = existingIds.map((i) => parseInt(i, 10)).filter((n) => !Number.isNaN(n));
  const max = numeric.length ? Math.max(...numeric) : 0;
  let candidate = String(max + 1);
  while (existingIds.includes(candidate)) candidate = `${candidate}-new`;
  return candidate;
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
      setSelectedChainId(null);
      setEditingNodeId(null);

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

  // Called when a search result is picked. Expands any collapsed
  // ancestors so the node becomes visible, briefly highlights it, and
  // pans/zooms the canvas to bring it into view.
  const highlightTimeoutRef = useRef(null);

  const focusOnNode = useCallback(
    (id) => {
      setNodes((prevNodes) => {
        const ancestors = [];
        let current = parentMapRef.current[id];
        while (current) {
          ancestors.push(current);
          current = parentMapRef.current[current];
        }
        const ancestorSet = new Set(ancestors);

        const expanded = prevNodes.map((n) =>
          ancestorSet.has(n.id) && n.data.hasChildren && n.data.expanded === false
            ? { ...n, data: { ...n.data, expanded: true } }
            : n
        );

        const hiddenMap = computeHiddenMap(expanded, parentMapRef.current);
        hiddenMapRef.current = hiddenMap;

        return expanded.map((n) => ({
          ...n,
          hidden: hiddenMap[n.id],
          data: { ...n.data, highlighted: n.id === id },
        }));
      });

      setEdges((prevEdges) =>
        prevEdges.map((e) => ({
          ...e,
          hidden: hiddenMapRef.current[e.target] ?? e.hidden,
        }))
      );

      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, highlighted: false } } : n
          )
        );
      }, 2500);

      // Wait a tick for the now-unhidden node to actually render before
      // asking ReactFlow to fit the view around it.
      setTimeout(() => {
        instanceRef.current?.fitView({
          nodes: [{ id }],
          duration: 600,
          padding: 2,
          maxZoom: 1,
        });
      }, 100);
    },
    [setNodes, setEdges]
  );

  // --- Reporting-chain highlight ---------------------------------------
  // Click a node: highlight it and every node above it up to the top.
  // Click it again, or click empty canvas, to clear.
  const [selectedChainId, setSelectedChainId] = useState(null);

  useEffect(() => {
    const chainIds = selectedChainId
      ? computeChainIds(selectedChainId, parentMapRef.current)
      : new Set();

    setNodes((prev) =>
      prev.map((n) => {
        const inChain = chainIds.has(n.id);
        if (Boolean(n.data.chainHighlighted) === inChain) return n;
        return { ...n, data: { ...n.data, chainHighlighted: inChain } };
      })
    );

    setEdges((prev) =>
      prev.map((e) => {
        const inChain = chainIds.has(e.source) && chainIds.has(e.target);
        return { ...e, style: inChain ? { stroke: "#2563eb", strokeWidth: 2.5 } : undefined };
      })
    );
  }, [selectedChainId, setNodes, setEdges]);

  // --- Two-way editing ---------------------------------------------------
  const [editingNodeId, setEditingNodeId] = useState(null);
  const editingNode = nodes.find((n) => n.id === editingNodeId) || null;

  const closeEditModal = useCallback(() => setEditingNodeId(null), []);

  // Save edits to Role/Level/Experience, and re-parent if "Reports to"
  // was changed. Position is left exactly where it was — only the
  // connecting line moves to point at the new parent.
  const handleSaveNode = useCallback(
    (id, fields) => {
      const newParentId = fields.parentId || null;
      const parentChanged = (parentMapRef.current[id] ?? null) !== newParentId;
      if (parentChanged) {
        parentMapRef.current[id] = newParentId;
        setSelectedChainId(null);
      }

      setNodes((prevNodes) => {
        const updated = prevNodes.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: fields.label,
                  level: fields.level,
                  experience: fields.experience,
                },
              }
            : n
        );
        const withChildren = withHasChildren(updated, parentMapRef.current);
        const hiddenMap = computeHiddenMap(withChildren, parentMapRef.current);
        hiddenMapRef.current = hiddenMap;
        return withChildren.map((n) => ({ ...n, hidden: hiddenMap[n.id] }));
      });

      if (parentChanged) {
        setEdges((prevEdges) => {
          const withoutOld = prevEdges.filter((e) => e.target !== id);
          const withNew = newParentId
            ? [
                ...withoutOld,
                { id: `e${newParentId}-${id}`, source: newParentId, target: id },
              ]
            : withoutOld;
          return withNew.map((e) => ({
            ...e,
            hidden: hiddenMapRef.current[e.target] ?? e.hidden,
          }));
        });
      }

      setEditingNodeId(null);
    },
    [setNodes, setEdges]
  );

  // Removing a position bubbles its direct reports up to whoever it
  // reported to, so the rest of the chart stays connected.
  const handleDeleteNode = useCallback(
    (id) => {
      const deletedParentId = parentMapRef.current[id] ?? null;

      Object.keys(parentMapRef.current).forEach((childId) => {
        if (parentMapRef.current[childId] === id) {
          parentMapRef.current[childId] = deletedParentId;
        }
      });
      delete parentMapRef.current[id];

      setNodes((prevNodes) => {
        const withoutDeleted = prevNodes.filter((n) => n.id !== id);
        const withChildren = withHasChildren(withoutDeleted, parentMapRef.current);
        const hiddenMap = computeHiddenMap(withChildren, parentMapRef.current);
        hiddenMapRef.current = hiddenMap;
        return withChildren.map((n) => ({ ...n, hidden: hiddenMap[n.id] }));
      });

      setEdges((prevEdges) =>
        prevEdges
          .filter((e) => e.target !== id)
          .map((e) => {
            if (e.source !== id) {
              return { ...e, hidden: hiddenMapRef.current[e.target] ?? e.hidden };
            }
            if (!deletedParentId) return null; // bubbled child becomes a new root
            return {
              id: `e${deletedParentId}-${e.target}`,
              source: deletedParentId,
              target: e.target,
              hidden: hiddenMapRef.current[e.target] ?? e.hidden,
            };
          })
          .filter(Boolean)
      );

      setSelectedChainId(null);
      setEditingNodeId(null);
    },
    [setNodes, setEdges]
  );

  // Adds a blank new direct report under parentId, then immediately
  // switches the modal to edit it so HR can fill in the role right away.
  const handleAddChild = useCallback(
    (parentId) => {
      const existingIds = nodesRef.current.map((n) => n.id);
      const newId = nextId(existingIds);
      parentMapRef.current[newId] = parentId;
      setSelectedChainId(null);

      const parentNode = nodesRef.current.find((n) => n.id === parentId);
      const basePosition = parentNode?.position ?? { x: 0, y: 0 };

      setNodes((prevNodes) => {
        const withNew = [
          ...prevNodes,
          {
            id: newId,
            type: "custom",
            position: { x: basePosition.x, y: basePosition.y + 170 },
            data: {
              id: newId,
              label: "New Position",
              level: parentNode?.data.level || "L1",
              experience: "",
              hasChildren: false,
              expanded: true,
              onToggle,
            },
          },
        ].map((n) =>
          n.id === parentId ? { ...n, data: { ...n.data, expanded: true } } : n
        );

        const withChildren = withHasChildren(withNew, parentMapRef.current);
        const hiddenMap = computeHiddenMap(withChildren, parentMapRef.current);
        hiddenMapRef.current = hiddenMap;
        return withChildren.map((n) => ({ ...n, hidden: hiddenMap[n.id] }));
      });

      setEdges((prevEdges) => [
        ...prevEdges,
        {
          id: `e${parentId}-${newId}`,
          source: parentId,
          target: newId,
          hidden: hiddenMapRef.current[newId],
        },
      ]);

      setEditingNodeId(newId);
    },
    [onToggle, setNodes, setEdges]
  );

  const clickTimerRef = useRef(null);

  const handleNodeClick = useCallback((event, node) => {
    if (clickTimerRef.current) return; // part of a double-click, let that handler take over
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      setSelectedChainId((prev) => (prev === node.id ? null : node.id));
    }, 220);
  }, []);

  const handleNodeDoubleClick = useCallback((event, node) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setEditingNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedChainId(null);
  }, []);

  // Downloads the chart exactly as it currently stands — including any
  // edits made directly in the portal — as a fresh .xlsx in the same
  // column format the sheet importer expects, so HR can save it as
  // their new master file.
  const handleExportExcel = useCallback(() => {
    const currentNodes = nodesRef.current;
    const rows = currentNodes.map((n) => ({
      "Sr No.": n.id,
      "Sr No. to report to": parentMapRef.current[n.id] ?? "",
      Role: n.data.label,
      Level: n.data.level,
      Experience: n.data.experience || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Org Chart");
    XLSX.writeFile(workbook, `career-architecture-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={
        isFullscreen
          ? "h-full w-full bg-white flex flex-col"
          : "h-full w-full rounded-xl overflow-hidden border bg-white flex flex-col"
      }
    >
      <ExcelToolbar onDataLoaded={handleExcelData} onExport={handleExportExcel} />

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
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          nodesDraggable
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap />
          <NodeSearch nodes={nodes} onSelect={focusOnNode} />
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

      <EditNodeModal
        node={editingNode}
        currentParentId={editingNodeId ? parentMapRef.current[editingNodeId] ?? null : null}
        nodes={nodes}
        edges={edges}
        onSave={handleSaveNode}
        onDelete={handleDeleteNode}
        onAddChild={handleAddChild}
        onClose={closeEditModal}
      />
    </div>
  );
}
