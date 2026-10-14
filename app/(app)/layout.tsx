import { NewGrantsAlert } from "@/components/new-grants-alert";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="container">{children}</div>
        <NewGrantsAlert />
      </main>
    </div>
  );
}
