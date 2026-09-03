import { redirect } from "next/navigation";

/** Server layouts: stale JWT (user deleted) vs truly suspended. */
export function redirectForSessionUser(row) {
  if (!row) {
    redirect("/login?session=expired");
  }
  if (row.status === "SUSPENDED") {
    redirect("/login?suspended=1");
  }
}
