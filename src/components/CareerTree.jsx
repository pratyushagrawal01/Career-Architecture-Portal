import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  ControlButton,
  MiniMap,
  useNodesState,
  useEdgesState,
  getNodesBounds,
} from "reactflow";
import { Maximize2, Minimize2, ImageDown } from "lucide-react";
import { toPng } from "html-to-image";

import CustomNode from "./CustomNode";
import DeletableEdge from "./DeletableEdge";
import NodeSearch from "./NodeSearch";
import EditNodeModal from "./EditNodeModal";
import { loadChart, saveChart } from "../utils/storage";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { deletable: DeletableEdge };

// BFS up through every incoming connection — since a node can now have
// more than one parent, "the path to the top" is the union of every
// ancestor reachable via any combination of connections, not a single
// straight line. The visited-set also protects against infinite loops
// if someone accidentally wires up a cycle.
function computeAncestorIds(id, edgesList) {
  const ids = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const current = queue.shift();
    edgesList.forEach((e) => {
      if (e.target === current && !ids.has(e.source)) {
        ids.add(e.source);
        queue.push(e.source);
      }
    });
  }
  return ids;
}

// A node's "closed" state cascades up from its parents rather than
// being set directly (except via the manual toggle in the edit
// modal). A node with no parents is only closed if it was manually
// closed. A node WITH parents is closed only once every single one of
// its parents is (effectively) closed — so a child with two parents,
// only one of which is closed, still shows as open. Manually marking
// a node closed always wins for that node itself, regardless of its
// parents.
function computeEffectiveClosed(nodesList, edgesList) {
  const parentsOf = new Map(nodesList.map((n) => [n.id, []]));
  edgesList.forEach((e) => {
    if (parentsOf.has(e.target)) parentsOf.get(e.target).push(e.source);
  });
  const manualClosed = new Map(nodesList.map((n) => [n.id, Boolean(n.data.manuallyClosed)]));

  const resolved = new Map();
  function resolve(id, visiting) {
    if (resolved.has(id)) return resolved.get(id);
    if (visiting.has(id)) return false; // cycle guard — never seen in practice
    visiting.add(id);

    const parents = parentsOf.get(id) || [];
    let closed;
    if (manualClosed.get(id)) {
      closed = true;
    } else if (parents.length === 0) {
      closed = false;
    } else {
      closed = parents.every((p) => resolve(p, visiting));
    }

    visiting.delete(id);
    resolved.set(id, closed);
    return closed;
  }

  nodesList.forEach((n) => resolve(n.id, new Set()));
  return resolved;
}

// A node's *visibility* cascades from its parents' expand state, using
// the same all-parents-must-agree logic as the closed cascade above,
// just inverted: a node is hidden only once every single parent path
// into it is blocked (that parent is itself hidden, or collapsed).
// So collapsing one of two parents still leaves the child visible
// through the other — only collapsing (or hiding) every parent folds
// it away. Root nodes (no parents) are never hidden by this.
function computeHiddenIds(nodesList, edgesList) {
  const parentsOf = new Map(nodesList.map((n) => [n.id, []]));
  edgesList.forEach((e) => {
    if (parentsOf.has(e.target)) parentsOf.get(e.target).push(e.source);
  });
  const expandedOf = new Map(nodesList.map((n) => [n.id, n.data.expanded !== false]));

  const resolved = new Map();
  function resolve(id, visiting) {
    if (resolved.has(id)) return resolved.get(id);
    if (visiting.has(id)) return false; // cycle guard
    visiting.add(id);

    const parents = parentsOf.get(id) || [];
    let hidden;
    if (parents.length === 0) {
      hidden = false;
    } else {
      hidden = parents.every((p) => resolve(p, visiting) || !expandedOf.get(p));
    }

    visiting.delete(id);
    resolved.set(id, hidden);
    return hidden;
  }

  nodesList.forEach((n) => resolve(n.id, new Set()));
  return resolved;
}

// Picks a fresh id for a newly-placed node: one past the highest
// existing numeric id already on the chart.
function nextId(existingIds) {
  const numeric = existingIds.map((i) => parseInt(i, 10)).filter((n) => !Number.isNaN(n));
  const max = numeric.length ? Math.max(...numeric) : 0;
  return String(max + 1);
}

function buildInitialChart() {
  const saved = loadChart();
  if (saved && saved.nodes.length) {
    return {
      nodes: saved.nodes.map((n) => ({
        id: n.id,
        type: "custom",
        position: n.position,
        data: {
          id: n.id,
          label: n.data.label,
          level: n.data.level,
          experience: n.data.experience,
          manuallyClosed: Boolean(n.data.manuallyClosed),
          expanded: n.data.expanded !== false,
        },
      })),
      edges: saved.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  }
  // Nothing saved yet — start with an empty canvas. The Role Library
  // in the sidebar comes pre-seeded, so there's always something to
  // drag on right away.
  return { nodes: [], edges: [] };
}

const initialChart = buildInitialChart();

export default function CareerTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialChart.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialChart.edges);

  // Kept in sync after every render so handlers that shouldn't need to
  // change identity on every drag (drop handler, etc.) can still read
  // the latest node list.
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const edgeStyleBackupRef = useRef({});
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

  // --- Auto-save --------------------------------------------------------
  // localStorage is now the only place this data lives (no more Excel
  // file backing it), so every change gets persisted, debounced so a
  // drag doesn't spam writes on every pixel of movement.
  useEffect(() => {
    const t = setTimeout(() => saveChart(nodes, edges), 500);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  // --- Reporting-chain highlight -----------------------------------------
  const [selectedChainId, setSelectedChainId] = useState(null);

  useEffect(() => {
    const chainIds = selectedChainId ? computeAncestorIds(selectedChainId, edges) : new Set();

    setNodes((prev) =>
      prev.map((n) => {
        const inChain = chainIds.has(n.id);
        if (Boolean(n.data.chainHighlighted) === inChain) return n;
        return { ...n, data: { ...n.data, chainHighlighted: inChain } };
      })
    );

    setEdges((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        const inChain = chainIds.has(e.source) && chainIds.has(e.target);
        const currentlyInChain = e.style?.stroke === "#2563eb";
        if (currentlyInChain === inChain) return e;
        changed = true;
        return { ...e, style: inChain ? { stroke: "#2563eb", strokeWidth: 2.5 } : undefined };
      });
      return changed ? next : prev;
    });
    // Deliberately not depending on `edges` here (only on
    // selectedChainId) — see onConnect/onEdgesChange below, which
    // clear the selection on any structural change instead. Depending
    // on `edges` directly would risk a feedback loop since this effect
    // itself writes to edges' style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChainId, setNodes, setEdges]);

  // --- Open/closed cascade -------------------------------------------------
  // Recomputed whenever the *structure* that actually affects it
  // changes (edges, or a manual closed toggle) — not on every drag, so
  // this stays a plain string dependency rather than the raw nodes
  // array, which would otherwise re-run on every pixel of movement.
  const closedComputationKey = useMemo(() => {
    const manualPart = nodes.map((n) => `${n.id}:${n.data.manuallyClosed ? 1 : 0}`).join(",");
    const edgePart = edges.map((e) => `${e.source}>${e.target}`).join(",");
    return `${manualPart}|${edgePart}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  useEffect(() => {
    const effectiveClosed = computeEffectiveClosed(nodes, edges);
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        const closed = effectiveClosed.get(n.id) || false;
        if (Boolean(n.data.closed) === closed) return n;
        changed = true;
        return { ...n, data: { ...n.data, closed } };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closedComputationKey, setNodes]);

  // --- Expand/collapse ------------------------------------------------------
  const handleToggleExpand = useCallback(
    (id) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, expanded: n.data.expanded === false } }
            : n
        )
      );
    },
    [setNodes]
  );

  const hasChildrenIds = useMemo(() => new Set(edges.map((e) => e.source)), [edges]);

  // Same drag-safe trick as the closed cascade: only recompute
  // visibility when the actual graph shape or an expand toggle
  // changes, not on every pixel of a drag.
  const visibilityKey = useMemo(() => {
    const expandedPart = nodes.map((n) => `${n.id}:${n.data.expanded === false ? 0 : 1}`).join(",");
    const edgePart = edges.map((e) => `${e.source}>${e.target}`).join(",");
    return `${expandedPart}|${edgePart}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const hiddenMap = useMemo(
    () => computeHiddenIds(nodes, edges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibilityKey]
  );

  const nodesForFlow = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        hidden: hiddenMap.get(n.id) || false,
        data: {
          ...n.data,
          hasChildren: hasChildrenIds.has(n.id),
          expanded: n.data.expanded !== false,
          onToggle: handleToggleExpand,
        },
      })),
    [nodes, hiddenMap, hasChildrenIds, handleToggleExpand]
  );

  // --- Manual connections -------------------------------------------------
  const onEdgesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "remove")) setSelectedChainId(null);
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase]
  );

  const onConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }
      setSelectedChainId(null);
      setEdges((prev) => {
        const exists = prev.some(
          (e) => e.source === connection.source && e.target === connection.target
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            source: connection.source,
            target: connection.target,
          },
        ];
      });
    },
    [setEdges]
  );

  // --- Drag a role from the sidebar onto the canvas -----------------------
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/x-role");
      if (!raw || !instanceRef.current) return;

      let role;
      try {
        role = JSON.parse(raw);
      } catch {
        return;
      }

      const position = instanceRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newId = nextId(nodesRef.current.map((n) => n.id));
      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: "custom",
          position,
          data: {
            id: newId,
            label: role.label,
            level: role.level,
            experience: role.experience || "",
            expanded: true,
          },
        },
      ]);
    },
    [setNodes]
  );

  // --- Search --------------------------------------------------------------
  const highlightTimeoutRef = useRef(null);

  const focusOnNode = useCallback(
    (id) => {
      // Make sure the node is actually on screen before trying to focus
      // it — expand every ancestor above it that's currently collapsed.
      setNodes((prev) => {
        const ancestorIds = computeAncestorIds(id, edges);
        let changed = false;
        const next = prev.map((n) => {
          if (n.id === id || !ancestorIds.has(n.id) || n.data.expanded !== false) return n;
          changed = true;
          return { ...n, data: { ...n.data, expanded: true } };
        });
        return changed ? next : prev;
      });

      setNodes((prev) =>
        prev.map((n) => ({ ...n, data: { ...n.data, highlighted: n.id === id } }))
      );

      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, highlighted: false } } : n
          )
        );
      }, 2500);

      // A short delay lets any branch we just expanded actually render
      // before we ask React Flow to frame it.
      setTimeout(() => {
        instanceRef.current?.fitView({
          nodes: [{ id }],
          duration: 600,
          padding: 2,
          maxZoom: 1,
        });
      }, 60);
    },
    [edges, setNodes]
  );

  // --- Two-way editing -------------------------------------------------------
  const [editingNodeId, setEditingNodeId] = useState(null);
  const editingNode = nodes.find((n) => n.id === editingNodeId) || null;

  const closeEditModal = useCallback(() => setEditingNodeId(null), []);

  const handleSaveNode = useCallback(
    (id, fields) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: fields.label,
                  level: fields.level,
                  experience: fields.experience,
                  manuallyClosed: Boolean(fields.manuallyClosed),
                },
              }
            : n
        )
      );
      setEditingNodeId(null);
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (id) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      setSelectedChainId((prev) => (prev === id ? null : prev));
      setEditingNodeId(null);
    },
    [setNodes, setEdges]
  );

  // --- Deleting a single connection ----------------------------------------
  // Triggered from the "x" button that appears on an edge once its line
  // has been clicked (see DeletableEdge). Removes just that connection —
  // the two roles it linked are untouched, though the open/closed
  // cascade above will recompute since the graph shape changed.
  const handleDeleteEdge = useCallback(
    (edgeId) => {
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      setSelectedChainId(null);
    },
    [setEdges]
  );

  const edgesForFlow = useMemo(() => {
    const expandedOf = new Map(nodes.map((n) => [n.id, n.data.expanded !== false]));
    return edges.map((e) => {
      const sourceExpanded = expandedOf.get(e.source) !== false;
      const targetHidden = hiddenMap.get(e.target) || false;
      return {
        ...e,
        type: "deletable",
        hidden: targetHidden || !sourceExpanded,
        data: { onDelete: handleDeleteEdge },
      };
    });
  }, [edges, nodes, hiddenMap, handleDeleteEdge]);

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

  // --- Download chart as PNG ------------------------------------------------
  // Temporarily expands every collapsed branch so the exported image
  // shows the whole org, not just whatever happens to be open on
  // screen, then restores the prior expand/collapse state afterward.
  const handleDownloadImage = useCallback(() => {
    const instance = instanceRef.current;
    const viewportEl = wrapperRef.current?.querySelector(".react-flow__viewport");
    if (!instance || !viewportEl) return;

    const previousExpandedById = Object.fromEntries(
      nodesRef.current.map((n) => [n.id, n.data.expanded !== false])
    );
    setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, expanded: true } })));

    // Default edges color themselves via a CSS variable, which
    // html-to-image frequently fails to resolve — force an explicit
    // stroke for the capture, then restore whatever each edge had.
    setEdges((prevEdges) => {
      edgeStyleBackupRef.current = Object.fromEntries(prevEdges.map((e) => [e.id, e.style]));
      return prevEdges.map((e) => ({
        ...e,
        style: {
          stroke: e.style?.stroke || "#94a3b8",
          strokeWidth: e.style?.strokeWidth || 1.5,
        },
      }));
    });

    const restore = () => {
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          data: { ...n.data, expanded: previousExpandedById[n.id] ?? n.data.expanded },
        }))
      );
      setEdges((prevEdges) =>
        prevEdges.map((e) => ({ ...e, style: edgeStyleBackupRef.current[e.id] }))
      );
    };

    // Give the DOM a moment to actually render the newly-expanded
    // branches (and measure their real dimensions) before capturing.
    setTimeout(() => {
      const visibleNodes = instance.getNodes().filter((n) => !n.hidden);
      if (visibleNodes.length === 0) {
        restore();
        return;
      }
      const bounds = getNodesBounds(visibleNodes);
      const PADDING = 60;
      const imageWidth = Math.round(bounds.width + PADDING * 2);
      const imageHeight = Math.round(bounds.height + PADDING * 2);

      toPng(viewportEl, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px) scale(1)`,
        },
      })
        .then((dataUrl) => {
          const a = document.createElement("a");
          a.setAttribute(
            "download",
            `career-architecture-${new Date().toISOString().slice(0, 10)}.png`
          );
          a.setAttribute("href", dataUrl);
          a.click();
        })
        .finally(restore);
    }, 200);
  }, [setNodes, setEdges]);

  return (
    <div
      ref={wrapperRef}
      className={
        isFullscreen
          ? "h-full w-full bg-white flex flex-col"
          : "h-full w-full rounded-xl overflow-hidden border bg-white flex flex-col"
      }
    >
      <div className="flex-shrink-0 border-b bg-slate-50 px-4 py-2 text-xs text-slate-500 flex items-center justify-between">
        <span>
          Drag roles from the sidebar onto the chart, drag between the dots to connect
          them, click a connecting line to delete it, and use the arrow on a role to
          collapse or expand its branch.
        </span>
        <span className="flex-shrink-0 ml-3">
          {nodes.length} position{nodes.length === 1 ? "" : "s"} · {edges.length} connection
          {edges.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        className="flex-1 min-h-0"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleDrop}
      >
        <ReactFlow
          nodes={nodesForFlow}
          edges={edgesForFlow}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
            <ControlButton onClick={handleDownloadImage} title="Download chart as image">
              <ImageDown size={14} />
            </ControlButton>
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
        nodes={nodes}
        onSave={handleSaveNode}
        onDelete={handleDeleteNode}
        onClose={closeEditModal}
      />
    </div>
  );
}
