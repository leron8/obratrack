import { Header } from "./ui/Header";
import { Sidebar } from "./ui/Sidebar";
import Dashboard from "./Dashboard";

export default function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content-area">
        <Header />
        <Dashboard />
      </main>
    </div>
  );
}
