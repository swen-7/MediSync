import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/ping/AppShell";
import { useT_hook } from "@/store/usePingStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/integrations/supabase/auth-provider";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MediSync" },
      { name: "description", content: "Sign in to MediSync to manage medication reminders for your loved ones." },
    ],
  }),
  component: LoginPage,
});

const PENDING_ROLE_KEY = "pendingRegistrationRole";
const JUST_REGISTERED_KEY = "justRegistered";

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

  const [mode, setMode] = useState<"login" | "signup">("login");
  const isSU = mode === "signup";

  // Signup-only state
  const [role, setRole] = useState<AppRole>("supervisor");
  const [fullName, setFullName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // After login: route by DB role. Sign-up flow signs the user out
  // automatically (see auth-provider), so this only fires for true logins.
  useEffect(() => {
    if (loading || !session) return;
    if (!profile) return; // still loading profile / role
    if (!profile.role) return; // role row missing — wait for self-heal
    navigate({
      to: profile.role === "patient" ? "/patient-dashboard" : "/dashboard",
      replace: true,
    });
  }, [loading, session, profile, navigate]);

  const submit = async () => {
    setBusy(true);
    try {
      if (isSU) {
        const parsed = signupSchema.safeParse({ fullName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        // Mark this session as a fresh registration so the global auth
        // observer signs the user out and bounces them back to /login.
        window.localStorage.setItem(JUST_REGISTERED_KEY, "1");
        window.localStorage.setItem(PENDING_ROLE_KEY, role);

        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: {
              full_name: parsed.data.fullName,
              role,
              language_pref: "en",
            },
          },
        });
        if (error) {
          window.localStorage.removeItem(JUST_REGISTERED_KEY);
          window.localStorage.removeItem(PENDING_ROLE_KEY);
          throw error;
        }
        // If email confirmation is OFF, the auth observer handles toast +
        // signOut + redirect. If it is ON, no session is created — show a
        // hint so the user knows to check email.
        toast.success("Account created. Check your email if confirmation is required.");
        setMode("login");
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
        // Redirect handled by useEffect above.
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      if (isSU) {
        // Persist intent BEFORE redirecting away to Google.
        window.localStorage.setItem(JUST_REGISTERED_KEY, "1");
        window.localStorage.setItem(PENDING_ROLE_KEY, role);
      } else {
        // Sign-in: clear any leftover signup markers so login isn't bounced.
        window.localStorage.removeItem(JUST_REGISTERED_KEY);
        window.localStorage.removeItem(PENDING_ROLE_KEY);
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/login",
      });
      if (result.error) {
        window.localStorage.removeItem(JUST_REGISTERED_KEY);
        window.localStorage.removeItem(PENDING_ROLE_KEY);
        throw result.error;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      toast.error(msg);
      setBusy(false);
    }
  };

  // Loading spinner during the role-fetching phase to prevent white screens.
  const showSpinner = loading || (session && !profile?.role);

  return (
    <AppShell title="MediSync" showTabs={false}>
      <div className="flex-1 px-4 pt-3.5 pb-24">
        {showSpinner ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 border-4 border-green border-t-transparent rounded-full animate-spin" />
            <div className="text-fs-sm text-muted-foreground">Signing you in…</div>
          </div>
        ) : (
          <>
            <div className="font-display text-fs-xl font-semibold mt-1.5 mb-1">
              {isSU ? t("create_account") : t("sign_in")}
            </div>
            <div className="text-fs-sm text-muted-foreground mb-4 leading-relaxed">
              {isSU ? "Join MediSync" : "Sign in to continue"}
            </div>

            {/* Role toggle ONLY visible during signup. */}
            {isSU && (
              <div className="flex gap-2 mb-4">
                {(["supervisor", "patient"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-3 px-1.5 rounded-2xl border-[1.5px] font-bold text-fs-sm transition-colors ${
                      role === r
                        ? "border-green bg-green-l text-green"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {r === "supervisor" ? "👨‍👩‍👧 " : "👴 "}
                    {r === "supervisor" ? t("supervisor") : t("elderly")}
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
              onClick={() => setMode(isSU ? "login" : "signup")}
              className="w-full py-4 rounded-2xl bg-green-l text-green font-bold text-fs-base mt-2.5"
            >
              {isSU ? t("have_account") : t("no_account")}
            </button>
          </>
        )}
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
