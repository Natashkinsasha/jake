export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}
