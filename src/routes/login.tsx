import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { usePingStore, useT_hook } from "@/store/usePingStore";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Ping" },
      { name: "description", content: "Sign in to Ping to manage medication reminders for your loved ones." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const t = useT_hook();
  const navigate = useNavigate();
  const { loginRole, loginMode, setLoginRole, setLoginMode, doLogin } = usePingStore();
  const isSU = loginMode === "signup";

  const submit = () => {
    doLogin();
    navigate({ to: loginRole === "supervisor" ? "/dashboard" : "/my-meds" });
  };

  return (
    <AppShell title="Ping.">
      <div className="flex-1 px-4 pt-3.5 pb-24">
        <div className="font-display text-fs-xl font-semibold mt-1.5 mb-1">
          {isSU ? t("create_account") : t("sign_in")}
        </div>
        <div className="text-fs-sm text-muted-foreground mb-4 leading-relaxed">
          {isSU ? "Join Ping" : "Sign in to continue"}
        </div>

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

        <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-ping)] border border-border mb-3">
          {isSU && (
            <Field label={t("fullname")}>
              <input type="text" placeholder="e.g. Sarah Tan" className={inputCls} />
            </Field>
          )}
          <Field label={t("email")}>
            <input type="email" placeholder="your@email.com" className={inputCls} />
          </Field>
          <Field label={t("password")}>
            <input type="password" placeholder="••••••••" className={inputCls} />
          </Field>
          {isSU && loginRole === "supervisor" && (
            <Field label={t("groupname")}>
              <input type="text" placeholder="e.g. The Tan Family" className={inputCls} />
            </Field>
          )}
        </div>

        <button
          onClick={submit}
          className="w-full py-4 rounded-2xl bg-green text-white font-bold text-fs-base hover:opacity-90 transition-opacity"
        >
          {isSU ? t("create_account") : t("sign_in")}
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
