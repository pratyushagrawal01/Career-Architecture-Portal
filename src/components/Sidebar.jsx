import { useEffect, useRef, useState } from "react";
import { Network, Download, Upload } from "lucide-react";
import RoleLibrary from "./RoleLibrary";
import { loadRoles, saveRoles, exportBackup, importBackup } from "../utils/storage";
import { defaultRoles } from "../data/defaultRoles";

function generateRoleId() {
  return `role-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Sidebar() {
  const [roles, setRoles] = useState(() => loadRoles(defaultRoles));
  const importInputRef = useRef(null);

  useEffect(() => {
    saveRoles(roles);
  }, [roles]);

  const handleAddRole = (fields) => {
    setRoles((prev) => [...prev, { id: generateRoleId(), ...fields }]);
  };

  const handleUpdateRole = (id, fields) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  };

  const handleDeleteRole = (id) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importBackup(file);
      // Reload so the Role Library and the chart both freshly read
      // whatever was just written to localStorage.
      window.location.reload();
    } catch (err) {
      alert("Couldn't read that backup file — make sure it's a career-architecture-backup .json file.");
    }
  };

  return (
    <aside className="w-80 bg-[#0F2B5B] text-white flex flex-col">
      <div className="p-6 border-b border-blue-800 flex-shrink-0">
        <h2 className="text-xl font-bold">Career Architecture</h2>
      </div>

      <nav className="p-4 flex-shrink-0">
        <button className="w-full text-left rounded-lg px-4 py-3 bg-blue-700 font-semibold flex items-center gap-2">
          <Network size={18} />
          Org Chart
        </button>
      </nav>

      <RoleLibrary
        roles={roles}
        onAdd={handleAddRole}
        onUpdate={handleUpdateRole}
        onDelete={handleDeleteRole}
      />

      <div className="p-4 border-t border-blue-800 flex gap-2 flex-shrink-0">
        <button
          onClick={exportBackup}
          title="Download a backup of your roles and chart as a .json file"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-800/60 hover:bg-blue-800 rounded-lg px-3 py-2 font-medium"
        >
          <Download size={13} />
          Export
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          title="Restore roles and chart from a backup .json file"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-800/60 hover:bg-blue-800 rounded-lg px-3 py-2 font-medium"
        >
          <Upload size={13} />
          Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          onChange={handleImportChange}
          className="hidden"
        />
      </div>
    </aside>
  );
}
