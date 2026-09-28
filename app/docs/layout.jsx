import Link from "next/link";
import { customerDocsNav } from "@/lib/customer-docs";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const metadata = {
  title: "Aide Docs",
  description: "Customer documentation for Aide AI support agents.",
};

export default function DocsLayout({ children }) {
  const nav = customerDocsNav();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold text-foreground">
              Aide
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/docs" className="text-sm font-medium text-primary">
              Docs
            </Link>
          </div>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <DocsSidebar nav={nav} />
        </aside>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
