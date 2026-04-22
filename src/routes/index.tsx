import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { usePingStore, useT_hook } from "@/store/usePingStore";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ping — Never miss the moment that matters" },
      {
        name: "description",
        content:
          "Ping is a Malaysian medication reminder app for families and caregivers — PIN check-ins, pill photos, and family calendars to keep loved ones safe.",
      },
      { property: "og:title", content: "Ping — Medication reminders for Malaysian families" },
      {
        property: "og:description",
        content: "Automatic medication reminders, family check-ins, and care escalation built for Malaysia.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const t = useT_hook();
  const { setLoginRole, setLoginMode } = usePingStore();
  const navigate = useNavigate();
  const { profile, session, loading } = useAuth();

  // Auth guard: if already signed in, push to the right dashboard
  useEffect(() => {
    if (loading || !session || !profile?.role) return;
    navigate({ to: profile.role === "patient" ? "/my-meds" : "/dashboard" });
  }, [loading, session, profile?.role, navigate]);

  const goLogin = (role: "supervisor" | "elderly") => {
    setLoginRole(role);
    setLoginMode("login");
    navigate({ to: "/login" });
  };

  return (
    <AppShell showTabs={false}>
      <div>
        <div
          className="px-6 pt-13 pb-10 text-white text-center relative overflow-hidden"
          style={{ background: "linear-gradient(150deg, oklch(0.6 0.09 210) 0%, oklch(0.62 0.13 158) 100%)" }}
        >
          <div className="absolute -top-12 -right-12 w-[200px] h-[200px] rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -left-14 w-[250px] h-[250px] rounded-full bg-white/10" />
          <div className="inline-block bg-white/20 rounded-full px-3.5 py-1 text-fs-xs font-bold tracking-wider mb-3.5 relative z-10">
            SDG 3 · Good Health 🇲🇾
          </div>
          <h1 className="font-display text-[2rem] leading-tight mb-3.5 relative z-10">
            {t("landing_headline")}
          </h1>
          <p className="text-fs-sm opacity-90 leading-relaxed mb-7 relative z-10">{t("landing_sub")}</p>
          <div className="flex flex-col gap-2.5 relative z-10">
            <button
              onClick={() => goLogin("supervisor")}
              className="w-full py-3.5 rounded-2xl bg-white text-green font-bold text-fs-base shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
            >
              {t("iam_supervisor")}
            </button>
            <button
              onClick={() => goLogin("elderly")}
              className="w-full py-3.5 rounded-2xl bg-transparent text-white font-bold text-fs-base border-2 border-white/60"
            >
              {t("iam_elderly")}
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {[
            ["📷", t("feat1_title"), t("feat1_desc")],
            ["❤️", t("feat2_title"), t("feat2_desc")],
            ["🤝", t("feat3_title"), t("feat3_desc")],
            ["🔒", t("feat4_title"), t("feat4_desc")],
          ].map(([icon, title, desc]) => (
            <div
              key={title as string}
              className="bg-card rounded-2xl p-4 flex gap-3.5 items-start shadow-[var(--shadow-ping)] border border-border"
            >
              <div className="text-[1.6rem] shrink-0">{icon}</div>
              <div>
                <div className="font-extrabold mb-1 text-fs-sm">{title}</div>
                <div className="text-fs-xs text-muted-foreground leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-6 text-center text-fs-xs text-hint">
          NAIC 2026 · Built for Malaysian families
        </div>
      </div>
    </AppShell>
  );
}
