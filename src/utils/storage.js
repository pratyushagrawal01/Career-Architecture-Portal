// Excel is gone in this version, so the browser's localStorage is now
// the only place the role library and the chart actually live.
// exportBackup/importBackup exist as a manual safety net — without
// them, clearing browser data would silently wipe everything with no
// way to recover it.

const ROLES_KEY = "career-architecture-roles-v1";
const CHART_KEY = "career-architecture-chart-v1";

export function loadRoles(fallback) {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveRoles(roles) {
  try {
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  } catch {
    // best-effort — private browsing / storage quota issues shouldn't break the app
  }
}

export function loadChart() {
  try {
    const raw = localStorage.getItem(CHART_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveChart(nodesList, edgesList) {
  try {
    const slimNodes = nodesList.map((n) => ({
      id: n.id,
      position: n.position,
      style: { width: n.style?.width ?? 240, height: n.style?.height ?? 90 },
      data: {
        label: n.data.label,
        level: n.data.level,
        experience: n.data.experience,
        manuallyClosed: !!n.data.manuallyClosed,
        expanded: n.data.expanded === false ? false : true,
      },
    }));
    const slimEdges = edgesList.map((e) => ({ id: e.id, source: e.source, target: e.target }));
    localStorage.setItem(CHART_KEY, JSON.stringify({ nodes: slimNodes, edges: slimEdges }));
  } catch {
    // best-effort
  }
}

export function exportBackup() {
  const roles = loadRoles([]);
  const chart = loadChart() || { nodes: [], edges: [] };
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    roles,
    nodes: chart.nodes,
    edges: chart.edges,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `career-architecture-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file");
  }
  const roles = Array.isArray(parsed.roles) ? parsed.roles : [];
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  localStorage.setItem(CHART_KEY, JSON.stringify({ nodes, edges }));
}
