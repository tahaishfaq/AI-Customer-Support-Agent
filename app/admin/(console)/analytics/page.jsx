import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard — Admin",
};

export default function AdminAnalyticsRedirectPage() {
  redirect("/admin");
}
