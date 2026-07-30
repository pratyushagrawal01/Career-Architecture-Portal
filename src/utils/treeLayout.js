// Computes x/y positions for a flat list of { id, parentId } items,
// purely from the parent/child relationships. Excel rows don't carry
// pixel positions, so this runs every time the sheet is (re)loaded.
//
// Simple recursive layout: leaves are placed left-to-right in the
// order they're encountered; a parent is centered above the span of
// its children. Good enough for an org chart of this size without
// pulling in a full graph-layout dependency.

const HORIZONTAL_SPACING = 260;
const VERTICAL_SPACING = 170;

export function computeLayout(items) {
  const childrenMap = {};
  items.forEach((item) => {
    if (item.parentId) {
      childrenMap[item.parentId] = childrenMap[item.parentId] || [];
      childrenMap[item.parentId].push(item.id);
    }
  });

  const roots = items.filter((item) => !item.parentId);

  const positions = {};
  let cursor = 0;

  function layout(id, depth, visiting) {
    if (visiting.has(id)) {
      // Guards against an accidental cycle in the sheet's Parent ID
      // column (excelParser also breaks these, but stay defensive).
      const x = cursor * HORIZONTAL_SPACING;
      cursor += 1;
      positions[id] = { x, y: depth * VERTICAL_SPACING };
      return x;
    }
    visiting.add(id);

    const children = childrenMap[id] || [];
    if (children.length === 0) {
      const x = cursor * HORIZONTAL_SPACING;
      cursor += 1;
      positions[id] = { x, y: depth * VERTICAL_SPACING };
      return x;
    }

    const childXs = children.map((childId) => layout(childId, depth + 1, visiting));
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    positions[id] = { x, y: depth * VERTICAL_SPACING };
    return x;
  }

  roots.forEach((item) => layout(item.id, 0, new Set()));

  // Anything not reached gets placed as an extra root off to the side
  // (shouldn't normally happen since excelParser nulls out bad parent
  // references, but stay defensive).
  items.forEach((item) => {
    if (!(item.id in positions)) {
      const x = cursor * HORIZONTAL_SPACING;
      cursor += 1;
      positions[item.id] = { x, y: 0 };
    }
  });

  return positions;
}
