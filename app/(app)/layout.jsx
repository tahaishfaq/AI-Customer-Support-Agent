import { AppHeader } from "@/components/layout/AppHeader";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)]">
      <AppHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
