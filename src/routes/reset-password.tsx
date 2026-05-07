import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/ping/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password — MediSync" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = z.string().min(8, "At least 8 characters").max(72).safeParse(pw);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      navigate({ to: "/login", replace: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  const cls =
    "w-full border-[1.5px] border-border rounded-xl px-3 py-3 text-fs-base text-foreground bg-input-bg focus:outline-none focus:border-green transition-colors";

  return (
    <AppShell title="Reset password" showTabs={false}>
      <div className="flex-1 px-4 pt-3.5 pb-24">
        <div className="font-display text-fs-xl font-semibold mb-1">Set new password</div>
        <div className="text-fs-sm text-muted-foreground mb-4">
          Enter a new password for your account.
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-ping)] border border-border mb-3 space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            className={cls}
            autoComplete="new-password"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Confirm new password"
            className={cls}
            autoComplete="new-password"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !pw}
          className="w-full py-4 rounded-2xl bg-green text-white font-bold text-fs-base disabled:opacity-50"
        >
          {busy ? "..." : "Update password"}
        </button>
      </div>
    </AppShell>
  );
}