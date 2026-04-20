import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { usePingStore, useT_hook } from "@/store/usePingStore";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — Ping" },
      { name: "description", content: "Active medication alerts for your loved ones." },
    ],
  }),
  component: Page,
});

function Page() {
  const t = useT_hook();
  const { alerts, elders, resolveAlert, caregiverPhone } = usePingStore();
  const active = alerts.filter((a) => !a.resolved);
  const resolved = alerts.filter((a) => a.resolved);

  const findElderPhone = (name: string) =>
    elders.find((e) => e.name === name)?.phone || caregiverPhone;

  return (
    <AppShell title={t("alerts_title")}>
      <div className="flex-1 px-4 pt-4 pb-24">
        <div className="font-display text-fs-xl font-semibold mb-1">{t("alerts_title")}</div>
        <div className="text-fs-sm text-muted-foreground mb-4">
          {active.length} active · {resolved.length} resolved
        </div>

        {/* Emergency 999 — always available on Alerts */}
        <a
          href="tel:999"
          className="block w-full text-center bg-red text-white font-extrabold text-fs-base py-4 rounded-2xl shadow-[var(--shadow-ping)] mb-4 active:scale-[0.98] transition-transform"
        >
          {t("emergency_999")}
        </a>

        {active.length === 0 && resolved.length === 0 && (
          <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
            {t("alerts_empty")}
          </div>
        )}

        {active.map((a) => (
          <div
            key={a.id}
            className="bg-red-l border border-red rounded-2xl p-4 mb-3 shadow-[var(--shadow-ping)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-extrabold text-fs-base text-red">⚠️ {a.elderName}</div>
                <div className="text-fs-sm text-foreground mt-0.5">{a.elderMed}</div>
                <div className="text-fs-xs text-muted-foreground mt-1">
                  {a.time} · {a.ago} {t("alert_overdue")}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <a
                href={`tel:${findElderPhone(a.elderName).replace(/\s|-/g, "")}`}
                className="flex-1 text-center bg-red text-white font-bold text-fs-xs py-2.5 rounded-xl"
              >
                📞 {t("alert_call")}
              </a>
              <button
                onClick={() => resolveAlert(a.id)}
                className="flex-1 bg-card text-foreground border border-border font-bold text-fs-xs py-2.5 rounded-xl hover:bg-green-l hover:text-green hover:border-green transition-colors"
              >
                ✓ {t("alert_resolve")}
              </button>
            </div>
          </div>
        ))}

        {resolved.length > 0 && (
          <div className="mt-5">
            <div className="font-extrabold text-fs-sm mb-2 text-muted-foreground uppercase tracking-wider">
              {t("alert_resolved")}
            </div>
            {resolved.map((a) => (
              <div
                key={a.id}
                className="bg-card rounded-xl p-3 mb-2 border border-border opacity-70"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-fs-sm">{a.elderName}</div>
                    <div className="text-fs-xs text-muted-foreground">
                      {a.elderMed} · {a.time}
                    </div>
                  </div>
                  <span className="bg-green-l text-green text-fs-xs font-bold px-2.5 py-1 rounded-full">
                    ✓ {t("alert_resolved")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
