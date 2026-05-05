import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { usePatients } from "@/lib/patientContext";
import { useTimeFormat, formatClock } from "@/store/usePingStore";
import { ImageLightbox } from "@/components/ping/ImageLightbox";

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

interface MedLogRow {
  id: string;
  due_at: string;
  confirmed_at: string | null;
  status: string;
  photo1_url: string | null;
  photo2_url: string | null;
  med_name: string;
}

function Page() {
  const { profile } = useAuth();
  const { patients, loading: patientsLoading } = usePatients();
  const isSupervisor = profile?.role === "supervisor";
  const timeFmt = useTimeFormat();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalRow[]>([]);
  const [medLogs, setMedLogs] = useState<MedLogRow[]>([]);
  const [detailLog, setDetailLog] = useState<MedLogRow | null>(null);
  const [detailUrls, setDetailUrls] = useState<{ p1: string | null; p2: string | null } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
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
      setMedLogs([]);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase
        .from("vitals")
        .select("id, taken_at, blood_pressure_sys, blood_pressure_dia, pulse, blood_glucose, note")
        .eq("patient_id", targetPatientId)
        .order("taken_at", { ascending: false })
        .limit(100),
      supabase
        .from("medication_logs")
        .select("id, due_at, confirmed_at, status, photo1_url, photo2_url, medications(med_name)")
        .eq("patient_id", targetPatientId)
        .order("due_at", { ascending: false })
        .limit(100),
    ]).then(([{ data: vData }, { data: lData }]) => {
      setVitals((vData ?? []) as VitalRow[]);
      const logs: MedLogRow[] = ((lData ?? []) as Array<{
        id: string; due_at: string; confirmed_at: string | null; status: string;
        photo1_url: string | null; photo2_url: string | null;
        medications: { med_name: string } | { med_name: string }[] | null;
      }>).map((r) => {
        const medRel = r.medications;
        const medName = Array.isArray(medRel) ? medRel[0]?.med_name : medRel?.med_name;
        return {
          id: r.id,
          due_at: r.due_at,
          confirmed_at: r.confirmed_at,
          status: r.status,
          photo1_url: r.photo1_url,
          photo2_url: r.photo2_url,
          med_name: medName ?? "Medication",
        };
      });
      setMedLogs(logs);
      setDetailLog(null);
      setDetailUrls(null);
      setLoading(false);
    });
  }, [targetPatientId]);

  const toggleLog = async (log: MedLogRow) => {
    setDetailLog(log);
    setDetailUrls(null);
    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data } = await supabase.storage.from("med-photos").createSignedUrl(path, 300);
      return data?.signedUrl ?? null;
    };
    const [p1, p2] = await Promise.all([sign(log.photo1_url), sign(log.photo2_url)]);
    setDetailUrls({ p1, p2 });
  };

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

            <div className="font-extrabold text-fs-sm mb-2 mt-6 text-muted-foreground uppercase tracking-wider">
              Medication History
            </div>
            {loading ? (
              <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm">
                Loading…
              </div>
            ) : medLogs.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
                No medication logs yet.
              </div>
            ) : (
              medLogs.map((l) => {
                const taken = l.confirmed_at ?? l.due_at;
                const statusLabel =
                  l.status === "confirmed" ? "✓ Taken"
                  : l.status === "missed" ? "✗ Missed"
                  : "⏳ Pending";
                const statusCls =
                  l.status === "confirmed" ? "bg-green-l text-green"
                  : l.status === "missed" ? "bg-red-l text-red"
                  : "bg-amber-l text-amber";
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLog(l)}
                    className="w-full text-left bg-card rounded-xl p-3 mb-2 border border-border hover:bg-green-l/40 active:scale-[0.99] transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-fs-sm truncate">{l.med_name}</div>
                        <div className="text-fs-xs text-muted-foreground">
                          {l.status === "confirmed" ? "Taken at " : "Scheduled "} {fmt(taken)}
                        </div>
                      </div>
                      <span className={`text-fs-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-fs-xs text-green font-bold mt-1.5">View details →</div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
      {detailLog && (
        <div
          className="fixed inset-0 bg-black/60 z-[500] flex items-end justify-center"
          onClick={() => setDetailLog(null)}
        >
          <div
            className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 pb-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
            <div className="font-display text-fs-xl font-semibold mb-1">{detailLog.med_name}</div>
            <div className="text-fs-xs text-muted-foreground mb-1">Scheduled: {fmt(detailLog.due_at)}</div>
            {detailLog.confirmed_at && (
              <div className="text-fs-sm text-green font-bold mb-4">✓ Taken at {fmt(detailLog.confirmed_at)}</div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-fs-xs font-bold text-muted-foreground mb-1.5">Photo 1 · Pill in hand</div>
                {detailUrls?.p1 ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ src: detailUrls.p1!, alt: "Pill in hand" })}
                    className="w-full aspect-square rounded-xl border border-border bg-black/5 overflow-hidden"
                  >
                    <img src={detailUrls.p1} alt="Pill in hand" className="w-full h-full object-contain" />
                  </button>
                ) : (
                  <div className="w-full aspect-square rounded-xl border border-border bg-input-bg flex items-center justify-center text-fs-xs text-muted-foreground">
                    {detailLog.photo1_url ? "Loading…" : "No photo"}
                  </div>
                )}
              </div>
              <div>
                <div className="text-fs-xs font-bold text-muted-foreground mb-1.5">Photo 2 · Bottle / pack</div>
                {detailUrls?.p2 ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ src: detailUrls.p2!, alt: "Medication bottle / pack" })}
                    className="w-full aspect-square rounded-xl border border-border bg-black/5 overflow-hidden"
                  >
                    <img src={detailUrls.p2} alt="Medication bottle / pack" className="w-full h-full object-contain" />
                  </button>
                ) : (
                  <div className="w-full aspect-square rounded-xl border border-border bg-input-bg flex items-center justify-center text-fs-xs text-muted-foreground">
                    {detailLog.photo2_url ? "Loading…" : "No photo"}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setDetailLog(null)}
              className="w-full bg-green text-white font-bold py-3 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
