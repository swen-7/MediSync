import { Link, useLocation, useRouter, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePingStore, initials, useT_hook, useLiveClock } from "@/store/usePingStore";
import { useAuth } from "@/integrations/supabase/auth-provider";

export function AppShell({
  title,
  children,
  showTabs = true,
}: {
  title?: string;
  children: ReactNode;
  showTabs?: boolean;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const t = useT_hook();
  const { theme, lang, toggleTheme, cycleLang } = usePingStore();
  const { profile, session, signOut } = useAuth();
  const langLabel = ({ en: "EN", ms: "BM", zh: "中文" } as const)[lang];
  const clock = useLiveClock();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const goSettings = () => navigate({ to: "/settings" });
  const goAlerts = () => navigate({ to: "/alerts" });
  const isSupervisor = profile?.role === "supervisor";

  return (
    <div className="min-h-screen flex flex-col max-w-[480px] mx-auto bg-background relative">
      <nav className="bg-[var(--nav-bg)] border-b border-border px-3.5 h-[54px] flex items-center justify-between sticky top-0 z-[200] shadow-[var(--shadow-ping)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.history.back()}
            className="text-muted-foreground text-lg px-2 py-1.5 rounded-lg hover:bg-green-l hover:text-green min-w-9 min-h-9 leading-none transition-colors"
            title="Back"
          >
            ←
          </button>
          {!session && (
            <Link to="/" className="font-display text-2xl font-semibold text-green ml-1 tracking-tight">
              MediSync
            </Link>
          )}
        </div>
        <div className="flex flex-col items-center min-w-0 px-1">
          {title && (
            <div className="font-bold text-fs-xs text-foreground max-w-[130px] text-center truncate leading-tight">
              {title}
            </div>
          )}
          {session && (
            <div className="font-mono tabular-nums text-[0.65rem] text-muted-foreground leading-tight mt-0.5">
              {clock}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={cycleLang}
            className="bg-transparent border-[1.5px] border-border text-muted-foreground text-fs-xs px-2.5 py-1.5 rounded-full font-bold hover:bg-green-l hover:border-green hover:text-green transition-colors"
          >
            {langLabel}
          </button>
          <button
            onClick={toggleTheme}
            className="bg-transparent border-[1.5px] border-border text-muted-foreground text-fs-xs px-2.5 py-1.5 rounded-full font-bold hover:bg-green-l hover:border-green hover:text-green transition-colors"
          >
            {theme === "light" ? t("dark") : t("light")}
          </button>
          {profile && isSupervisor && (
            <button
              onClick={goAlerts}
              title="Alerts"
              aria-label="Alerts"
              className="text-muted-foreground text-base px-2 py-1.5 rounded-lg hover:bg-amber-l hover:text-amber transition-colors"
            >
              🔔
            </button>
          )}
          {profile && (
            <>
              <button
                onClick={goSettings}
                title="Settings"
                className="w-[34px] h-[34px] rounded-full bg-green-l border-2 border-green-m flex items-center justify-center text-[0.7rem] font-extrabold text-green hover:bg-green hover:text-white transition-colors"
              >
                {initials(profile.full_name || "U")}
              </button>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="text-muted-foreground text-fs-xs px-2 py-1.5 rounded-lg hover:bg-red-l hover:text-red"
              >
                ⎋
              </button>
            </>
          )}
        </div>
      </nav>

      {children}

      {profile && showTabs && <BottomTabs />}
      <UndoToast />
    </div>
  );
}

function BottomTabs() {
  const { profile } = useAuth();
  const t = useT_hook();
  const location = useLocation();
  if (!profile) return null;

  const supTabs = [
    { to: "/dashboard", icon: "🏠", lbl: t("home_tab") },
    { to: "/calendar", icon: "📅", lbl: t("calendar_tab") },
    { to: "/clinics", icon: "🏥", lbl: t("clinics_tab") },
    { to: "/history", icon: "📋", lbl: t("history_tab") },
    { to: "/settings", icon: "⚙️", lbl: t("settings_tab") },
  ];
  const eldTabs = [
    { to: "/my-meds", icon: "💊", lbl: t("my_meds") },
    { to: "/calendar", icon: "📅", lbl: t("calendar_tab") },
    { to: "/clinics", icon: "🏥", lbl: t("clinics_tab") },
    { to: "/settings", icon: "⚙️", lbl: t("settings_tab") },
  ];
  const tabs = profile.role === "patient" ? eldTabs : supTabs;

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-[var(--tab-bg)] border-t border-border flex pt-1.5 pb-4 z-[200] shadow-[0_-2px_12px_rgba(0,0,0,0.07)]">
      {tabs.map((tb) => {
        const active = location.pathname === tb.to;
        return (
          <Link
            key={tb.to}
            to={tb.to}
            className={`flex-1 flex flex-col items-center gap-[3px] cursor-pointer transition-colors text-[0.68rem] font-bold py-1 uppercase tracking-wider ${
              active ? "text-green" : "text-hint"
            }`}
          >
            <div className="text-[1.3rem] leading-none">{tb.icon}</div>
            <div>{tb.lbl}</div>
          </Link>
        );
      })}
    </div>
  );
}

function UndoToast() {
  const { undoToast, clearUndo } = usePingStore();
  if (!undoToast) return null;
  return (
    <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 bg-[#1c2e25] text-white px-5 py-3 rounded-xl text-fs-xs font-bold flex items-center gap-3.5 z-[500] shadow-[0_4px_20px_rgba(0,0,0,0.3)] whitespace-nowrap max-w-[90vw]">
      <span>{undoToast.msg}</span>
      <button
        onClick={() => {
          undoToast.undo();
          clearUndo();
        }}
        className="bg-green border-none text-white px-3 py-1.5 rounded-lg font-bold text-fs-xs cursor-pointer"
      >
        Undo
      </button>
    </div>
  );
}
