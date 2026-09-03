"use client";

import { useState } from "react";
import { toast } from "sonner";
import { submitCustomPlanRequest } from "@/lib/api/billing";
import { BASIC_PLAN_NAME } from "@/lib/billing/plan-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CustomPlanRequestForm({ planId, open, onOpenChange }) {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await submitCustomPlanRequest({
        planId,
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim(),
      });
      setSent(true);
      toast.success("Request sent — our team will email you.");
    } catch (err) {
      toast.error(err.message || "Unable to send request");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenChange(next) {
    if (!next) {
      setSent(false);
      setCompanyName("");
      setPhone("");
      setMessage("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contact us for Custom</DialogTitle>
          <DialogDescription>
            Tell us about your team and volume. We will reach out by email — this
            does not unlock the dashboard until you pick {BASIC_PLAN_NAME} or a paid plan.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 py-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              We received your request. Our team will contact you at your account
              email shortly.
            </p>
            <Button type="button" className="w-full" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-company">Company (optional)</Label>
              <Input
                id="custom-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-phone">Phone (optional)</Label>
              <Input
                id="custom-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-message">What do you need?</Label>
              <Textarea
                id="custom-message"
                rows={4}
                required
                minLength={10}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Team size, brands, expected conversation volume…"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
