import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/ping/AppShell";
import { useT_hook } from "@/store/usePingStore";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/lib/patientContext";
import { PatientSwitcher } from "@/components/ping/PatientSwitcher";
import { useRoleGuard } from "@/lib/roleGuard";
import { useLocation } from "@tanstack/react-router";
import { exportAdherencePdf } from "@/lib/pdfExport";
import { toast } from "sonner";
import { subscribeUserToPush } from "@/lib/push";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MediSync" },
      { name: "description", content: "Supervisor dashboard: monitor your loved ones' medication adherence in real time." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const t = useT_hook();
  const navigate = useNavigate();
  const location = useLocation();
  useRoleGuard(location.pathname);
  const { session, loading } = useAuth();
  const { selected } = usePatients();
  const patientId = selected?.id ?? null;

  const [meds, setMeds] = useState<MedRow[]>([]);
  const [medsLoading, setMedsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // Supervisor opts into background push once dashboard is reachable.
  useEffect(() => {
    if (session?.user?.id) {
      subscribeUserToPush(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!patientId) {
      setMeds([]);
      return;
    }
    setMedsLoading(true);
    supabase
      .from("medications")
      .select("id, med_name, dosage, frequency, scheduled_time, remaining_qty, refill_reminder_days, unit")
      .eq("patient_id", patientId)
      .eq("active", true)
      .order("scheduled_time")
      .then(({ data }) => {
        setMeds((data ?? []) as MedRow[]);
        setMedsLoading(false);
      });
  }, [patientId]);

  const lowStock = meds.filter((m) => {
    const d = freqDoses(m.frequency);
    if (d <= 0) return false;
    return Math.floor(m.remaining_qty / d) <= m.refill_reminder_days;
  });

  const handleExport = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      await exportAdherencePdf({
        patientId: selected.id,
        patientName: selected.full_name,
        patientAge: selected.age ?? null,
      });
      toast.success("Report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell title="MediSync">
      <div className="flex-1 px-4 pt-3.5 pb-24">
        <PatientSwitcher />

        {lowStock.length > 0 && (
          <div className="bg-amber-l border border-amber rounded-xl p-3.5 mb-3.5 flex items-center gap-3">
            <div className="text-lg">💊</div>
            <div className="text-fs-xs font-bold text-amber leading-snug">
              {t("refill_warning")} {lowStock.map((m) => m.med_name).join(", ")}
            </div>
          </div>
        )}

        <SectionHeader
          title={t("medications")}
          action="Manage"
          onAction={() => navigate({ to: "/medications" })}
        />
        {!patientId ? null : medsLoading ? (
          <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm mb-3">
            Loading…
          </div>
        ) : meds.length === 0 ? (
          <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm mb-3">
            No medications yet.{" "}
            <Link to="/medications" className="text-green font-bold underline">
              Add one
            </Link>
            .
          </div>
        ) : (
          meds.map((m) => {
            const d = freqDoses(m.frequency);
            const daysLeft = d > 0 ? Math.floor(m.remaining_qty / d) : null;
            const low = daysLeft !== null && daysLeft <= m.refill_reminder_days;
            return (
              <div
                key={m.id}
                className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-fs-base truncate">{m.med_name}</div>
                    <div className="text-fs-xs text-muted-foreground mt-0.5">
                      {m.dosage} · {m.frequency} · {m.scheduled_time.slice(0, 5)}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-fs-xs font-bold shrink-0 ${
                      low ? "bg-amber-l text-amber" : "bg-teal-l text-teal"
                    }`}
                  >
                    {m.remaining_qty} {m.unit}
                  </span>
                </div>
              </div>
            );
          })
        )}

        <a
          href="tel:999"
          className="block w-full text-center bg-red text-white font-extrabold text-fs-base py-4 rounded-2xl shadow-[var(--shadow-ping)] mt-4 active:scale-[0.98] transition-transform"
        >
          {t("emergency_999")}
        </a>

        {patientId && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full mt-6 bg-card border-2 border-green text-green font-extrabold text-fs-sm py-3 rounded-2xl shadow-[var(--shadow-ping)] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {exporting ? "Generating…" : `📄 ${t("pdf_export_button")}`}
          </button>
        )}
      </div>
    </AppShell>
  );
}

interface MedRow {
  id: string;
  med_name: string;
  dosage: string;
  frequency: string;
  scheduled_time: string;
  remaining_qty: number;
  refill_reminder_days: number;
  unit: string;
}

function freqDoses(f: string) {
  if (f === "Twice daily") return 2;
  if (f === "Three times daily") return 3;
  if (f === "Four times daily") return 4;
  if (f === "As needed") return 0;
  return 1;
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
