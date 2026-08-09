import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import OrgChartPage from "./pages/OrgChartPage";

export default function App() {
  return (
    <div className="flex h-screen w-screen bg-slate-100">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <Header />

        <main className="flex-1 overflow-hidden p-6">
          <OrgChartPage />
        </main>
      </div>
    </div>
  );
}
