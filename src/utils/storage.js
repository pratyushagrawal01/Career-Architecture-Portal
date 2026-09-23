// Excel is gone in this version, so the browser's localStorage is now
// the only place the role library and the charts actually live.
// exportBackup/importBackup exist as a manual safety net — without
// them, clearing browser data would silently wipe everything with no
// way to recover it.

const ROLES_KEY = "career-architecture-roles-v1";
const FONT_KEY = "career-architecture-font-v1";
const CHARTS_INDEX_KEY = "career-architecture-charts-v1";
const CHART_DATA_PREFIX = "career-architecture-chart-data-v1-";
const ACTIVE_CHART_KEY = "career-architecture-active-chart-v1";

// Pre-multi-chart versions of the app kept a single chart under this
// key. It's read once, during migration, then left alone.
const LEGACY_CHART_KEY = "career-architecture-chart-v1";

function generateChartId() {
  return `chart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const defaultFontSettings = {
  fontFamily: "Inter, sans-serif",
  fontScale: 1,
};

export function loadFontSettings() {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    if (!raw) return defaultFontSettings;
    const parsed = JSON.parse(raw);
    return {
      fontFamily:
        typeof parsed.fontFamily === "string" && parsed.fontFamily
          ? parsed.fontFamily
          : defaultFontSettings.fontFamily,
      fontScale:
        typeof parsed.fontScale === "number" && parsed.fontScale > 0
          ? parsed.fontScale
          : defaultFontSettings.fontScale,
    };
  } catch {
    return defaultFontSettings;
  }
}

export function saveFontSettings(settings) {
  try {
    localStorage.setItem(FONT_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}

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

// --- Charts index (the list shown in the sidebar) ---------------------

function readChartsIndexRaw() {
  try {
    const raw = localStorage.getItem(CHARTS_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

// Returns the list of { id, name } charts, always at least one. The
// very first time this runs (no index saved yet), it migrates
// whatever was under the old single-chart key into chart #1 instead
// of silently dropping it.
export function loadChartsIndex() {
  const existing = readChartsIndexRaw();
  if (existing) return existing;

  let legacyChart = null;
  try {
    const raw = localStorage.getItem(LEGACY_CHART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        legacyChart = parsed;
      }
    }
  } catch {
    // ignore — fall through to a blank chart
  }

  const id = generateChartId();
  const index = [{ id, name: "Career Chart" }];
  try {
    localStorage.setItem(CHARTS_INDEX_KEY, JSON.stringify(index));
    localStorage.setItem(
      CHART_DATA_PREFIX + id,
      JSON.stringify(legacyChart || { nodes: [], edges: [] })
    );
    localStorage.setItem(ACTIVE_CHART_KEY, id);
  } catch {
    // best-effort
  }
  return index;
}

export function saveChartsIndex(index) {
  try {
    localStorage.setItem(CHARTS_INDEX_KEY, JSON.stringify(index));
  } catch {
    // best-effort
  }
}

export function loadActiveChartId(index) {
  try {
    const raw = localStorage.getItem(ACTIVE_CHART_KEY);
    if (raw && index.some((c) => c.id === raw)) return raw;
  } catch {
    // ignore
  }
  return index[0]?.id ?? null;
}

export function saveActiveChartId(id) {
  try {
    localStorage.setItem(ACTIVE_CHART_KEY, id);
  } catch {
    // best-effort
  }
}

// Creates a new, blank chart and returns its { id, name } entry —
// caller is responsible for adding it to the index it keeps in state.
export function createChart(name) {
  const id = generateChartId();
  try {
    localStorage.setItem(CHART_DATA_PREFIX + id, JSON.stringify({ nodes: [], edges: [] }));
  } catch {
    // best-effort
  }
  return { id, name };
}

export function deleteChartData(id) {
  try {
    localStorage.removeItem(CHART_DATA_PREFIX + id);
  } catch {
    // best-effort
  }
}

// --- A single chart's nodes/edges --------------------------------------

export function loadChart(id) {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(CHART_DATA_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveChart(id, nodesList, edgesList) {
  if (!id) return;
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
    const slimEdges = edgesList.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    localStorage.setItem(
      CHART_DATA_PREFIX + id,
      JSON.stringify({ nodes: slimNodes, edges: slimEdges })
    );
  } catch {
    // best-effort
  }
}

// --- Backup / restore (covers roles + every chart + font settings) ------

export function exportBackup() {
  const roles = loadRoles([]);
  const fontSettings = loadFontSettings();
  const index = loadChartsIndex();
  const charts = index.map((c) => {
    const data = loadChart(c.id) || { nodes: [], edges: [] };
    return { id: c.id, name: c.name, nodes: data.nodes, edges: data.edges };
  });
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    roles,
    charts,
    fontSettings,
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
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));

  if (parsed.fontSettings && typeof parsed.fontSettings === "object") {
    saveFontSettings({
      fontFamily: parsed.fontSettings.fontFamily || defaultFontSettings.fontFamily,
      fontScale: parsed.fontSettings.fontScale || defaultFontSettings.fontScale,
    });
  }

  if (Array.isArray(parsed.charts) && parsed.charts.length) {
    // Current (multi-chart) backup format.
    const index = parsed.charts.map((c) => ({
      id: typeof c.id === "string" && c.id ? c.id : generateChartId(),
      name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Untitled Chart",
    }));
    parsed.charts.forEach((c, i) => {
      localStorage.setItem(
        CHART_DATA_PREFIX + index[i].id,
        JSON.stringify({
          nodes: Array.isArray(c.nodes) ? c.nodes : [],
          edges: Array.isArray(c.edges) ? c.edges : [],
        })
      );
    });
    localStorage.setItem(CHARTS_INDEX_KEY, JSON.stringify(index));
    localStorage.setItem(ACTIVE_CHART_KEY, index[0].id);
  } else {
    // Older, single-chart backup format.
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    const id = generateChartId();
    localStorage.setItem(CHARTS_INDEX_KEY, JSON.stringify([{ id, name: "Career Chart" }]));
    localStorage.setItem(CHART_DATA_PREFIX + id, JSON.stringify({ nodes, edges }));
    localStorage.setItem(ACTIVE_CHART_KEY, id);
  }
}
