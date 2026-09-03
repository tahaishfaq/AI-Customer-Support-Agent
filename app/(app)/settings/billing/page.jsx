import { BillingSettings } from "@/components/billing/BillingSettings";

export const metadata = {
  title: "Billing — AIDE",
};

export default function SettingsBillingPage() {
  return (
    <main className="aide-page">
      <BillingSettings />
    </main>
  );
}
