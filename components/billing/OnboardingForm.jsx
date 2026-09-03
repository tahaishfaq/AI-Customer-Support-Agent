"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitOnboarding } from "@/lib/api/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** value === label so trigger + dropdown always match (Base UI items). */
const COMPANY_TYPES = [
  { value: "E-commerce", label: "E-commerce" },
  { value: "SaaS", label: "SaaS" },
  { value: "Agency", label: "Agency" },
  { value: "Services", label: "Services" },
  { value: "Other", label: "Other" },
];

const TEAM_SIZES = [
  { value: "Just me", label: "Just me" },
  { value: "2–5 people", label: "2–5 people" },
  { value: "6–20 people", label: "6–20 people" },
  { value: "21+ people", label: "21+ people" },
];

const CONVERSATION_BANDS = [
  { value: "Under 100 / month", label: "Under 100 / month" },
  { value: "100–500 / month", label: "100–500 / month" },
  { value: "500–2,000 / month", label: "500–2,000 / month" },
  { value: "2,000+ / month", label: "2,000+ / month" },
];

const PRIMARY_GOALS = [
  { value: "Deflect support tickets", label: "Deflect support tickets" },
  { value: "24/7 FAQ on my site", label: "24/7 FAQ on my site" },
  { value: "AI + human handoff", label: "AI + human handoff" },
  { value: "Capture sales leads", label: "Capture sales leads" },
  { value: "Connect orders / APIs", label: "Connect orders / APIs" },
];

const COUNTRIES = [
  { value: "Pakistan", label: "Pakistan" },
  { value: "United Arab Emirates", label: "United Arab Emirates" },
  { value: "Saudi Arabia", label: "Saudi Arabia" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "India", label: "India" },
];

/** Map display country → ISO for SafePay. */
const COUNTRY_TO_ISO = {
  Pakistan: "PK",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  "United States": "US",
  "United Kingdom": "GB",
  India: "IN",
};

function InterestSelect({
  label,
  items,
  value,
  onValueChange,
  placeholder,
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value || null}
        onValueChange={(next) => onValueChange(next ?? "")}
        items={items}
      >
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              label={item.label}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function OnboardingForm({
  initialFirstName = "",
  initialLastName = "",
  email = "",
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [monthlyConversations, setMonthlyConversations] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [busy, setBusy] = useState(false);

  function goNext(event) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error("Please complete your name and phone");
      return;
    }
    setStep(1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!companyType || !teamSize || !monthlyConversations || !primaryGoal) {
      toast.error("Please complete all interest fields");
      return;
    }

    setBusy(true);
    try {
      await submitOnboarding({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        country: COUNTRY_TO_ISO[country] || "PK",
        websiteUrl: websiteUrl.trim(),
        companyType,
        teamSize,
        monthlyConversations,
        primaryGoal,
      });
      toast.success("Saved — choose a plan next");
      router.push("/billing/plans");
    } catch (err) {
      toast.error(err.message || "Unable to save onboarding");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6 flex items-center gap-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 0 ? (
        <form onSubmit={goNext} className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Billing profile
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for SafePay checkout prefill. Email comes from your account.
            </p>
          </div>

          {email ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="h-11" />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              required
              placeholder="+92 300 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
            />
          </div>

          <InterestSelect
            label="Country"
            items={COUNTRIES}
            value={country}
            onValueChange={setCountry}
            placeholder="Country"
          />

          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Interest
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Helps us tailor limits and setup. Website is optional.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-url">Website URL (optional)</Label>
            <Input
              id="website-url"
              type="url"
              placeholder="https://yourcompany.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="h-11"
            />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              If you add one, we crawl public pages after you reach the
              dashboard — not during this form.
            </p>
          </div>

          <InterestSelect
            label="Company type"
            items={COMPANY_TYPES}
            value={companyType}
            onValueChange={setCompanyType}
            placeholder="Select type"
          />

          <InterestSelect
            label="Team size"
            items={TEAM_SIZES}
            value={teamSize}
            onValueChange={setTeamSize}
            placeholder="Select team size"
          />

          <InterestSelect
            label="Monthly support conversations (estimate)"
            items={CONVERSATION_BANDS}
            value={monthlyConversations}
            onValueChange={setMonthlyConversations}
            placeholder="Select volume"
          />

          <InterestSelect
            label="Primary goal with AIDE"
            items={PRIMARY_GOALS}
            value={primaryGoal}
            onValueChange={setPrimaryGoal}
            placeholder="What do you want first?"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Saving…" : "Continue to plans"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
