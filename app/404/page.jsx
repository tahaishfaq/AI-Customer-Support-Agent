import { NotFoundView } from "@/components/layout/NotFoundView";

export const metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function HiddenNotFoundPage() {
  return <NotFoundView />;
}
