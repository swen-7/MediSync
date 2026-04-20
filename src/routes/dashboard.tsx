import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { usePingStore, useT_hook, tzTime, initials } from "@/store/usePingStore";
import type { SupervisorRate, Status } from "@/store/usePingStore";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ping" },
      { name: "description", content: "Caregiver dashboard: monitor your loved ones' medication adherence in real time." },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && !usePingStore.getState().user) {
      throw redirect({ to: "/" });
    }
  },
  component: Dashboard,
});

function Dashboard() {
  const t = useT_hook();
  const navigate = useNavigate();
  const { elders, alerts, hist7, supervisorRates, confirmElder, missedElder } = usePingStore();
  const hasAlert = alerts.some((a) => !a.resolved);
  const lowStock = elders.flatMap((e) =>
    e.medications.filter((m) => {
      const dl = Math.round(m.remainingQty / (m.freq === "Twice daily" ? 2 : m.freq === "Three times daily" ? 3 : 1));
      return dl <= m.refillAlertDays;
    }),
  );

  return (
    <AppShell title="Ping.">
      <div className="flex-1 px-4 pt-3.5 pb-24">
        {hasAlert && (
          <div
            onClick={() => navigate({ to: "/alerts" })}
            className="bg-red-l border border-red rounded-xl p-3.5 mb-3.5 flex items-center gap-3 cursor-pointer"
          >
            <div className="text-lg">⚠️</div>
            <div className="text-fs-xs font-bold text-red leading-snug">
              Uncle David hasn't confirmed — Tap to view
            </div>
          </div>
        )}
        {lowStock.length > 0 && (
          <div className="bg-amber-l border border-amber rounded-xl p-3.5 mb-3.5 flex items-center gap-3">
            <div className="text-lg">💊</div>
            <div className="text-fs-xs font-bold text-amber leading-snug">
              {t("refill_warning")} {lowStock.map((m) => m.name).join(", ")}
            </div>
          </div>
        )}

        <SectionHeader title={t("your_loved_ones")} action={t("add")} onAction={() => {}} />
        {elders.map((e) => (
          <Link
            key={e.id}
            to="/dashboard"
            className="block bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-3 hover:-translate-y-0.5 transition-transform"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-extrabold text-fs-base">
                  {e.name}, {e.age}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-fs-xs text-muted-foreground">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      e.status === "confirmed" ? "bg-green" : e.status === "missed" ? "bg-red" : "bg-amber"
                    }`}
                  />
                  {e.status === "confirmed"
                    ? t("confirmed_today")
                    : e.status === "missed"
                    ? t("missed_today")
                    : t("awaiting")}
                  <span className="bg-teal-l text-teal px-2 py-0.5 rounded-full text-[0.75rem] font-bold ml-1">
                    🕐 {tzTime(e.timezone)}
                  </span>
                </div>
              </div>
              <Tag status={e.status} />
            </div>
            <div className="flex gap-1 mt-2">
              {hist7.map((h, i) => (
                <div
                  key={i}
                  className={`w-7 h-[22px] rounded-md flex items-center justify-center text-[0.72rem] font-extrabold ${
                    h === "confirmed"
                      ? "bg-green-l text-green"
                      : h === "missed"
                      ? "bg-red-l text-red"
                      : "bg-input-bg text-hint"
                  }`}
                >
                  {h === "confirmed" ? "✓" : h === "missed" ? "✗" : "·"}
                </div>
              ))}
            </div>
          </Link>
        ))}

        <SectionHeader title={t("today_log")} className="mt-3.5" />
        <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-ping)] border border-border mb-3.5">
          <div className="flex justify-between items-center py-1 border-b border-border mb-2.5">
            <div>
              <div className="font-bold">Grandma Rose</div>
              <div className="text-muted-foreground text-fs-sm">Amlodipine 5mg · 8:00 MYT</div>
            </div>
            <Tag status="confirmed" />
          </div>
          <div className="flex justify-between items-center mb-2.5">
            <div>
              <div className="font-bold">Uncle David</div>
              <div className="text-muted-foreground text-fs-sm">Atenolol 50mg · 9:00 MYT</div>
            </div>
            <Tag status="pending" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => confirmElder(2)}
              className="flex-1 bg-green-l text-green border-none py-2.5 rounded-xl font-bold text-fs-xs hover:bg-green-l/80 transition-colors"
            >
              {t("confirmed_taken")}
            </button>
            <button
              onClick={() => missedElder(2)}
              className="flex-1 bg-red-l text-red border-none py-2.5 rounded-xl font-bold text-fs-xs hover:bg-red-l/80 transition-colors"
            >
              {t("could_not_reach")}
            </button>
          </div>
        </div>

        <SectionHeader title={t("checkin_rate")} action="View all" onAction={() => {}} />
        {supervisorRates.slice(0, 2).map((r) => (
          <RateCard key={r.name} r={r} />
        ))}
      </div>
    </AppShell>
  );
}

function SectionHeader({
  title, action, onAction, className = "",
}: { title: string; action?: string; onAction?: () => void; className?: string }) {
  return (
    <div className={`flex items-center justify-between mb-2.5 ${className}`}>
      <div className="font-extrabold text-fs-sm">{title}</div>
      {action && (
        <button
          onClick={onAction}
          className="text-green text-fs-xs font-bold cursor-pointer bg-transparent border-none px-2 py-1 rounded-lg hover:bg-green-l"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function Tag({ status }: { status: Status }) {
  const t = useT_hook();
  const cls =
    status === "confirmed"
      ? "bg-green-l text-green"
      : status === "missed"
      ? "bg-red-l text-red"
      : "bg-amber-l text-amber";
  const label = status === "confirmed" ? t("done") : status === "missed" ? t("missed") : t("pending");
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-fs-xs font-bold shrink-0 ${cls}`}>{label}</span>;
}

function RateCard({ r }: { r: SupervisorRate }) {
  const cls = r.rate < 50 ? "bg-red" : r.rate < 70 ? "bg-amber" : "bg-green";
  const textCls = r.rate < 50 ? "text-red" : r.rate < 70 ? "text-amber" : "text-green";
  return (
    <div className="bg-card rounded-xl px-4 py-3.5 shadow-[var(--shadow-ping)] border border-border mb-2.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-green-l flex items-center justify-center font-extrabold text-green text-[0.68rem] shrink-0">
        {initials(r.name)}
      </div>
      <div className="flex-1">
        <div className="font-bold text-fs-sm mb-1">{r.name}</div>
        <div className="flex items-center gap-2.5">
          <div className="bg-input-bg rounded-md h-2.5 flex-1 overflow-hidden">
            <div className={`h-full rounded-md ${cls} transition-[width] duration-500`} style={{ width: `${r.rate}%` }} />
          </div>
          <span className={`text-fs-xs font-extrabold ${textCls} whitespace-nowrap`}>{r.rate}%</span>
        </div>
      </div>
    </div>
  );
}
