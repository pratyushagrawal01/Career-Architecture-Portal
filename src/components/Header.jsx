import { BriefcaseBusiness, Download } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-8 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Career Architecture Portal
        </h1>
      </div>


      <div className="p-4 border-t border-blue-800">
        <a
          href="/templates/Career Architecture Template.xlsx"
          download
          className="rounded-lg px-4 py-2 bg-blue-800 text-white hover:bg-blue-900 flex items-center gap-2 text-sm"
        >
          <Download size={16} />
          Download Excel Template
        </a>
      </div>
      {/*<div className="text-sm text-slate-500">
        V1 
      </div>*/}
    </header>
  );
}