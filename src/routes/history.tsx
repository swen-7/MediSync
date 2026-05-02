import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { usePatients } from "@/lib/patientContext";
import { useTimeFormat, formatClock } from "@/store/usePingStore";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — MediSync" },
    ],
  }),
  component: Page,
});

interface VitalRow {
  id: string;
  taken_at: string;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  pulse: number | null;
  blood_glucose: number | null;
  note: string | null;
}

function Page() {
  const { profile } = useAuth();
  const { patients, loading: patientsLoading } = usePatients();
  const isSupervisor = profile?.role === "supervisor";
  const timeFmt = useTimeFormat();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-pick first patient
  useEffect(() => {
    if (!selectedId && patients.length > 0) setSelectedId(patients[0].id);
  }, [patients, selectedId]);

  // For patients themselves, view their own vitals
  const targetPatientId = isSupervisor ? selectedId : profile?.id ?? null;

  useEffect(() => {
    if (!targetPatientId) {
      setVitals([]);
      return;
    }
    setLoading(true);
    supabase
      .from("vitals")
      .select("id, taken_at, blood_pressure_sys, blood_pressure_dia, pulse, blood_glucose, note")
      .eq("patient_id", targetPatientId)
      .order("taken_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setVitals((data ?? []) as VitalRow[]);
        setLoading(false);
      });
  }, [targetPatientId]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })} · ${formatClock(d, timeFmt)}`;
  };

  return (
    <AppShell title="History">
      <div className="flex-1 px-4 pt-4 pb-24">
        <div className="font-display text-fs-xl font-semibold mb-1">History</div>
        <div className="text-fs-sm text-muted-foreground mb-4">
          {isSupervisor ? "Linked patients & their vitals records." : "Your past vitals records."}
        </div>

        {isSupervisor && (
          patientsLoading ? (
            <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm mb-3">
              Loading patients…
            </div>
          ) : patients.length === 0 ? (
            <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
              No linked patients yet. Use the Link tab to add one.
            </div>
          ) : (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {patients.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`shrink-0 px-3.5 py-2 rounded-full font-bold text-fs-xs border transition-colors ${
                      active
                        ? "bg-green text-white border-green"
                        : "bg-card text-foreground border-border hover:bg-green-l hover:text-green hover:border-green"
                    }`}
                  >
                    {p.full_name}
                  </button>
                );
              })}
            </div>
          )
        )}

        {targetPatientId && (
          <>
            <div className="font-extrabold text-fs-sm mb-2 text-muted-foreground uppercase tracking-wider">
              Vitals Records
            </div>
            {loading ? (
              <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm">
                Loading…
              </div>
            ) : vitals.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
                No vitals recorded yet.
              </div>
            ) : (
              vitals.map((v) => (
                <div
                  key={v.id}
                  className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5"
                >
                  <div className="text-fs-xs text-muted-foreground mb-1.5">{fmt(v.taken_at)}</div>
                  <div className="flex flex-wrap gap-2">
                    {v.blood_pressure_sys != null && v.blood_pressure_dia != null && (
                      <span className="bg-teal-l text-teal text-fs-xs font-bold px-2.5 py-1 rounded-full">
                        🩸 BP {v.blood_pressure_sys}/{v.blood_pressure_dia}
                      </span>
                    )}
                    {v.pulse != null && (
                      <span className="bg-red-l text-red text-fs-xs font-bold px-2.5 py-1 rounded-full">
                        ❤️ {v.pulse} bpm
                      </span>
                    )}
                    {v.blood_glucose != null && (
                      <span className="bg-amber-l text-amber text-fs-xs font-bold px-2.5 py-1 rounded-full">
                        🍬 {v.blood_glucose} mmol/L
                      </span>
                    )}
                  </div>
                  {v.note && (
                    <div className="text-fs-xs text-foreground mt-2 italic">"{v.note}"</div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
