import AppShell from "../components/AppShell";
import Dashboard from "../components/Dashboard";

export default function Page() {
  return (
    <AppShell
      eyebrow="Construction Management"
      title="Financial Operations Dashboard"
      description="Track company-level cash flow, expense mix and recent movement activity from one place."
    >
      <Dashboard />
    </AppShell>
  );
}
