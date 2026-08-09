import CareerTree from "../components/CareerTree";

export default function OrgChartPage() {
  return (
    <div className="bg-white rounded-xl shadow h-full p-6 flex flex-col">

      <div className="flex-1 min-h-0">
        <CareerTree />
      </div>

    </div>
  );
}
