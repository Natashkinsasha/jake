interface RecentActivityProps {
  items: {
    type: "lesson" | "homework" | "vocabulary";
    title: string;
    subtitle: string;
    date: string;
  }[];
}

const icons: Record<string, string> = {
  lesson: "\uD83C\uDF99\uFE0F",
  homework: "\uD83D\uDCDA",
  vocabulary: "\uD83D\uDCDD",
};

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <p className="text-sm text-gray-400 text-center py-4">
          No activity yet. Start your first lesson!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <span className="text-xl">{icons[item.type] || "\uD83D\uDCCC"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
              <p className="text-xs text-gray-400">{item.subtitle}</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{item.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
