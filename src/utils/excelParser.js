import * as XLSX from "xlsx";

// HR shouldn't have to match column names exactly. Any of these
// (case/space/punctuation-insensitive) map to the same field.
const HEADER_ALIASES = {
  id: "id",
  srno: "id",
  srnumber: "id",
  sno: "id",
  employeeid: "id",

  parentid: "parentId",
  parent: "parentId",
  managerid: "parentId",
  reportsto: "parentId",
  srnotoreportto: "parentId",
  snotoreportto: "parentId",

  role: "label",
  label: "label",
  title: "label",
  position: "label",
  designation: "label",

  level: "level",
  grade: "level",
  band: "level",

  experience: "experience",
  yearsofexperience: "experience",
  years: "experience",
  tenure: "experience",
};

function normalizeHeader(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Turns a parsed workbook into { items, warnings }.
// items: [{ id, parentId, label, level, experience }]
// warnings: human-readable strings about rows that were skipped or adjusted.
export function parseWorkbookToTree(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const warnings = [];
  const items = [];
  const seenIds = new Set();

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // +1 for header row, +1 for 1-indexing
    const mapped = {};
    Object.entries(row).forEach(([key, value]) => {
      const canonical = HEADER_ALIASES[normalizeHeader(key)];
      if (canonical) mapped[canonical] = String(value ?? "").trim();
    });

    const isBlankRow = Object.values(mapped).every((v) => !v);
    if (isBlankRow) return;

    if (!mapped.id) {
      warnings.push(`Row ${rowNum}: missing Sr No. — row skipped.`);
      return;
    }
    if (!mapped.label) {
      warnings.push(`Row ${rowNum} (Sr No. "${mapped.id}"): missing Role — row skipped.`);
      return;
    }
    if (seenIds.has(mapped.id)) {
      warnings.push(`Row ${rowNum}: duplicate Sr No. "${mapped.id}" — row skipped.`);
      return;
    }
    seenIds.add(mapped.id);

    items.push({
      id: mapped.id,
      parentId: mapped.parentId || null,
      label: mapped.label,
      level: mapped.level || "L1",
      experience: mapped.experience || "",
    });
  });

  // Orphaned parent references (typo'd Parent ID, or that manager's
  // row was deleted) get demoted to top-level instead of vanishing.
  items.forEach((item) => {
    if (item.parentId && !seenIds.has(item.parentId)) {
      warnings.push(
        `"${item.label}" (Sr No. "${item.id}"): Sr No. to report to "${item.parentId}" not found — shown as a top-level box.`
      );
      item.parentId = null;
    }
  });

  // Break any accidental cycles (A reports to B, B reports to A, etc.)
  const parentOf = Object.fromEntries(items.map((i) => [i.id, i.parentId]));
  items.forEach((item) => {
    const seen = new Set();
    let current = item.id;
    while (parentOf[current]) {
      if (seen.has(current)) {
        warnings.push(
          `"${item.label}" (Sr No. "${item.id}") is part of a reporting-line loop — its Sr No. to report to was cleared.`
        );
        item.parentId = null;
        parentOf[item.id] = null;
        break;
      }
      seen.add(current);
      current = parentOf[current];
    }
  });

  return { items, warnings };
}

export async function readExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return parseWorkbookToTree(workbook);
}
