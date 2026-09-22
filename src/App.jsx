import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import OrgChartPage from "./pages/OrgChartPage";
import {
  loadChartsIndex,
  saveChartsIndex,
  loadActiveChartId,
  saveActiveChartId,
  createChart,
  deleteChartData,
} from "./utils/storage";

function nextChartName(existing) {
  let n = existing.length + 1;
  let name = `Chart ${n}`;
  const taken = new Set(existing.map((c) => c.name));
  while (taken.has(name)) {
    n += 1;
    name = `Chart ${n}`;
  }
  return name;
}

export default function App() {
  const [charts, setCharts] = useState(() => loadChartsIndex());
  const [activeChartId, setActiveChartId] = useState(() => loadActiveChartId(charts));

  useEffect(() => {
    saveChartsIndex(charts);
  }, [charts]);

  useEffect(() => {
    if (activeChartId) saveActiveChartId(activeChartId);
  }, [activeChartId]);

  const handleAddChart = () => {
    const chart = createChart(nextChartName(charts));
    setCharts((prev) => [...prev, chart]);
    setActiveChartId(chart.id);
  };

  const handleSelectChart = (id) => {
    setActiveChartId(id);
  };

  const handleRenameChart = (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
  };

  const handleDeleteChart = (id) => {
    setCharts((prev) => {
      // Always keep at least one chart on the board.
      if (prev.length <= 1) return prev;
      const next = prev.filter((c) => c.id !== id);
      deleteChartData(id);
      if (activeChartId === id) {
        setActiveChartId(next[0].id);
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100">
      <Sidebar
        charts={charts}
        activeChartId={activeChartId}
        onSelectChart={handleSelectChart}
        onAddChart={handleAddChart}
        onRenameChart={handleRenameChart}
        onDeleteChart={handleDeleteChart}
      />

      <div className="flex flex-col flex-1">
        <Header />

        <main className="flex-1 overflow-hidden p-6">
          {activeChartId && <OrgChartPage key={activeChartId} chartId={activeChartId} />}
        </main>
      </div>
    </div>
  );
}
