import type { ReactNode } from "react";
import { Header } from "./ui/Header";
import { Sidebar } from "./ui/Sidebar";

type AppShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
};

export default function AppShell({ children, eyebrow, title, description }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content-area">
        <Header eyebrow={eyebrow} title={title} description={description} />
        {children}
      </main>
    </div>
  );
}
