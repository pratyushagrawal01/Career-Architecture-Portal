// Default sample org-chart data — shown before HR loads their own Excel
// sheet, and matches the exact shape produced by excelParser.js:
// { id, parentId, label, level, experience }. No x/y position here —
// CareerTree lays the whole tree out automatically from parentId links,
// the same way it does for data loaded from Excel.

export const defaultTreeItems = [
//  { id: "1", parentId: null, label: "Chief Operating Officer", level: "N1" },
//
//  {
//    id: "2",
//    parentId: "1",
//    label: "Projects Execution Cluster Head",
//    level: "N2",
//    experience: "11.5 Years",
//  },

//  { id: "3", parentId: "2", label: "Project Director", level: "N2", experience: "9 Years" },
//  { id: "4", parentId: "2", label: "Governance Lead", level: "N2", experience: "8 Years" },

//  { id: "5", parentId: "3", label: "Project Manager", level: "L1", experience: "5 Years" },
//  { id: "6", parentId: "3", label: "Planning Lead", level: "L1", experience: "4 Years" },
//  { id: "7", parentId: "3", label: "Engineering Lead", level: "L1", experience: "6 Years" },
];

// Nodes whose children start out collapsed on first load.
export const initialCollapsedIds = ["3"];
