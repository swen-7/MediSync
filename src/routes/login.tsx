import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/ping/AppShell";
import { useT_hook, usePingStore } from "@/store/usePingStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Ping" },
      { name: "description", content: "Sign in to Ping to manage medication reminders for your loved ones." },
    ],
  }),
  component: LoginPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name too short").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const signinSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1).max(72),
});

function LoginPage() {
  const t = useT_hook();
  const navigate = useNavigate();
  const { profile, session, loading } = useAuth();
  const { loginRole, loginMode, setLoginRole, setLoginMode } = usePingStore();
  const isSU = loginMode === "signup";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Public guard: if already signed in, route by DB role (single source of truth)
  useEffect(() => {
    if (loading || !session || !profile) return;
    if (!profile.role) return; // wait for role row to load
    navigate({ to: profile.role === "patient" ? "/my-meds" : "/dashboard" });
  }, [loading, session, profile, navigate]);

  const dbRole = loginRole === "elderly" ? "patient" : "caregiver";

  const submit = async () => {
    setBusy(true);
    try {
      if (isSU) {
        const parsed = signupSchema.safeParse({ fullName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: parsed.data.fullName,
              role: dbRole,
              language_pref: usePingStore.getState().lang,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! Signing you in...");
      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        // role + redirect handled by useEffect above
      }
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (e: any) {
      toast.error(e?.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <AppShell title="Ping." showTabs={false}>
      <div className="flex-1 px-4 pt-3.5 pb-24">
        <div className="font-display text-fs-xl font-semibold mt-1.5 mb-1">
          {isSU ? t("create_account") : t("sign_in")}
        </div>
        <div className="text-fs-sm text-muted-foreground mb-4 leading-relaxed">
          {isSU ? "Join Ping" : "Sign in to continue"}
        </div>

        {/* Role toggle ONLY visible during signup. On sign-in, role comes from DB. */}
        {isSU && (
          <div className="flex gap-2 mb-4">
            {(["supervisor", "elderly"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setLoginRole(r)}
                className={`flex-1 py-3 px-1.5 rounded-2xl border-[1.5px] font-bold text-fs-sm transition-colors ${
                  loginRole === r
                    ? "border-green bg-green-l text-green"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {r === "supervisor" ? "👨‍👩‍👧 " : "👴 "}
                {t(r)}
              </button>
            ))}
          </div>
        )}

        <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-ping)] border border-border mb-3">
          {isSU && (
            <Field label={t("fullname")}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                type="text"
                placeholder="e.g. Sarah Tan"
                className={inputCls}
                autoComplete="name"
              />
            </Field>
          )}
          <Field label={t("email")}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="your@email.com"
              className={inputCls}
              autoComplete="email"
            />
          </Field>
          <Field label={t("password")}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className={inputCls}
              autoComplete={isSU ? "new-password" : "current-password"}
            />
          </Field>
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-4 rounded-2xl bg-green text-white font-bold text-fs-base hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? "..." : isSU ? t("create_account") : t("sign_in")}
        </button>

        <div className="my-3 flex items-center gap-3 text-muted-foreground text-fs-xs">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={google}
          disabled={busy}
          className="w-full py-4 rounded-2xl bg-card border border-border text-foreground font-bold text-fs-base flex items-center justify-center gap-2 hover:bg-input-bg transition-colors disabled:opacity-50"
        >
          <span className="text-lg">🔵</span> Continue with Google
        </button>

        <button
          onClick={() => setLoginMode(isSU ? "login" : "signup")}
          className="w-full py-4 rounded-2xl bg-green-l text-green font-bold text-fs-base mt-2.5"
        >
          {isSU ? t("have_account") : t("no_account")}
        </button>
      </div>
    </AppShell>
  );
}

const inputCls =
  "w-full border-[1.5px] border-border rounded-xl px-3 py-3 text-fs-base text-foreground bg-input-bg focus:outline-none focus:border-green transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 last:mb-0">
      <label className="block text-fs-xs font-extrabold text-hint mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
