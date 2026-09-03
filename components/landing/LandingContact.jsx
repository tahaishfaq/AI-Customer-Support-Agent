"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LandingReveal } from "@/components/landing/LandingReveal";

function FieldLabel({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block font-mono text-[11px] font-medium tracking-[0.14em] text-[var(--landing-ink)] uppercase"
    >
      {children}
    </label>
  );
}

const inputClass =
  "box-border h-10 w-full rounded-md border-0 bg-[#ececeb] px-3.5 text-[14px] leading-10 text-[var(--landing-ink)] outline-none placeholder:text-[var(--landing-muted)]/70 focus-visible:ring-2 focus-visible:ring-[var(--landing-ink)]/15";

const textareaClass =
  "box-border h-[5.5rem] w-full resize-none rounded-md border-0 bg-[#ececeb] px-3.5 py-2.5 text-[14px] leading-snug text-[var(--landing-ink)] outline-none placeholder:text-[var(--landing-muted)]/70 focus-visible:ring-2 focus-visible:ring-[var(--landing-ink)]/15";

export function LandingContact() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    company: "",
    message: "",
  });

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const company = form.company.trim();
    const message = form.message.trim();

    if (!fullName || !email || !message) {
      toast.error("Name, work email, and message are required");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, company, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Unable to send message");
      }
      setSent(true);
      setForm({ fullName: "", email: "", company: "", message: "" });
      toast.success("Thanks — we’ll reply within 24 hours.");
    } catch (err) {
      toast.error(err.message || "Unable to send message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="contact"
      className="landing-section bg-[#f3f2f0] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16">
        <LandingReveal>
          <div className="flex min-h-full flex-col">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
              Get started
            </p>

            <h2 className="landing-display mt-3 max-w-xl text-[2rem] leading-[1.12] text-[var(--landing-ink)] sm:text-[2.45rem] md:text-[2.85rem]">
              Ready to Build AI that Actually{" "}
              <span className="text-[var(--landing-muted)]">Works?</span>
            </h2>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base">
              Let&apos;s design a structured AI support system tailored to your
              workflows, tools, and business goals — without chaos, without
              experiments.
            </p>

            <p className="mt-10 flex gap-3 text-[14px] leading-relaxed text-[var(--landing-muted)]">
              <span
                aria-hidden
                className="mt-0.5 font-serif text-3xl leading-none text-[var(--landing-muted)]/50"
              >
                ”
              </span>
              <span>
                We reply within 24 hours. All conversations are confidential.
              </span>
            </p>
          </div>
        </LandingReveal>

        <LandingReveal delay={60}>
          <div className="rounded-lg border border-black/[0.08] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-8">
            {sent ? (
              <div className="flex min-h-[22rem] flex-col items-start justify-center">
                <p className="landing-display text-2xl text-[var(--landing-ink)]">
                  Message received.
                </p>
                <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--landing-muted)]">
                  Thanks for reaching out. We’ll get back within 24 hours.
                </p>
                <button
                  type="button"
                  className="mt-8 font-mono text-[12px] font-medium tracking-[0.12em] text-[var(--landing-ink)] uppercase underline underline-offset-4"
                  onClick={() => setSent(false)}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div>
                  <FieldLabel htmlFor="contact-name">Full name</FieldLabel>
                  <input
                    id="contact-name"
                    name="fullName"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    value={form.fullName}
                    onChange={update("fullName")}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="contact-email">Work email</FieldLabel>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="jane@company.com"
                    value={form.email}
                    onChange={update("email")}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="contact-company">Company name</FieldLabel>
                  <input
                    id="contact-company"
                    name="company"
                    autoComplete="organization"
                    placeholder="Your company name"
                    value={form.company}
                    onChange={update("company")}
                    className={inputClass}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="contact-message">
                    Tell us about your workflows or challenges
                  </FieldLabel>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={3}
                    placeholder="Type your message..."
                    value={form.message}
                    onChange={update("message")}
                    className={textareaClass}
                    required
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className="landing-btn-ink inline-flex h-12 w-full items-center justify-center rounded-md font-mono text-[12px] font-semibold tracking-[0.16em] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Get in touch"}
                  </button>
                </div>

                <p className="pt-1 text-center font-mono text-[10px] tracking-[0.08em] text-[var(--landing-muted)] uppercase">
                  By submitting, you agree to{" "}
                  <Link
                    href="/register"
                    className="underline underline-offset-2"
                  >
                    our terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/register"
                    className="underline underline-offset-2"
                  >
                    privacy policy
                  </Link>
                </p>
              </form>
            )}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
