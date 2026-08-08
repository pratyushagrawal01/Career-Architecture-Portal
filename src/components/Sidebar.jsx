import { BriefcaseBusiness, Download } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-72 bg-[#0F2B5B] text-white flex flex-col">

      <div className="p-6 border-b border-blue-800">
        <h2 className="text-xl font-bold">
          Career Architecture
        </h2>
      </div>

      <nav className="flex-1 p-4">

        <button className="w-full text-left rounded-lg px-4 py-3 mb-2 bg-blue-700 font-semibold flex items-center gap-2">
          <BriefcaseBusiness size={18}/>
          Architecture
        </button>

      </nav>
       
    </aside>
  );
}