import { useCallback, useEffect, useRef, useState } from "react";
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
import NodeSearch from "./NodeSearch";
import EditNodeModal from "./EditNodeModal";
import { loadChart, saveChart } from "../utils/storage";

const nodeTypes = { custom: CustomNode };

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
        style: { width: n.style?.width ?? 240, height: n.style?.height ?? 90 },
        data: {
          id: n.id,
          label: n.data.label,
          level: n.data.level,
          experience: n.data.experience,
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
          style: { width: 240, height: 90 },
          data: {
            id: newId,
            label: role.label,
            level: role.level,
            experience: role.experience || "",
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

      instanceRef.current?.fitView({
        nodes: [{ id }],
        duration: 600,
        padding: 2,
        maxZoom: 1,
      });
    },
    [setNodes]
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
  const handleDownloadImage = useCallback(() => {
    const instance = instanceRef.current;
    const viewportEl = wrapperRef.current?.querySelector(".react-flow__viewport");
    if (!instance || !viewportEl) return;

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

    const restoreStyles = () => {
      setEdges((prevEdges) =>
        prevEdges.map((e) => ({ ...e, style: edgeStyleBackupRef.current[e.id] }))
      );
    };

    setTimeout(() => {
      const visibleNodes = instance.getNodes();
      if (visibleNodes.length === 0) {
        restoreStyles();
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
        .finally(restoreStyles);
    }, 100);
  }, [setEdges]);

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
          Drag roles from the sidebar onto the chart, then drag between the dots to
          connect them.
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
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
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
