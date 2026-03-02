interface StatsCardProps {
  value: string | number;
  label: string;
  color?: string;
}

export function StatsCard({ value, label, color = "text-primary-600" }: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
