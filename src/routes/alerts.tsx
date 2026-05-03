import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useT_hook } from "@/store/usePingStore";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { usePatients } from "@/lib/patientContext";
import { PatientSwitcher } from "@/components/ping/PatientSwitcher";
import { computeWindow } from "@/lib/dueLogic";
import { toast } from "sonner";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — MediSync" },
      { name: "description", content: "Active medication alerts for your loved ones." },
    ],
  }),
  component: Page,
});

interface AlertRow {
  id: string;
  status: "pending" | "missed" | "confirmed";
  due_at: string;
  confirmed_at: string | null;
  resolved_at: string | null;
  video_url: string | null;
  photo1_url: string | null;
  photo2_url: string | null;
  med_name: string;
  patient_name: string;
  patient_phone: string | null;
}

function Page() {
  const t = useT_hook();
  const { profile } = useAuth();
  const { selected, patients } = usePatients();
  const isSupervisor = profile?.role === "supervisor";
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<AlertRow | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      setLoading(true);
      // Supervisor: scope to selected patient. Patient: own logs.
      const patientId = isSupervisor ? selected?.id : profile.id;
      if (!patientId) {
        setRows([]);
        setLoading(false);
        return;
      }
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("medication_logs")
        .select("id, status, due_at, confirmed_at, resolved_at, video_url, photo1_url, photo2_url, medication_id, medications(med_name)")
        .eq("patient_id", patientId)
        .gte("due_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
        .order("due_at", { ascending: false });
      if (error) toast.error(error.message);

      // Auto-detect overdue meds (no log yet but past 15min window)
      const { data: meds } = await supabase
        .from("medications")
        .select("id, med_name, scheduled_time")
        .eq("patient_id", patientId)
        .eq("active", true);
      const loggedIds = new Set((data ?? []).filter((d) => d.due_at >= startOfDay.toISOString()).map((d) => d.medication_id));
      const now = new Date();
      const synthetic: AlertRow[] = [];
      const patientName =
        isSupervisor ? selected?.full_name ?? "Patient" : profile.full_name;
      const patientPhone =
        isSupervisor ? selected?.phone ?? null : profile.phone;
      for (const m of meds ?? []) {
        if (loggedIds.has(m.id)) continue;
        const info = computeWindow(now, m.scheduled_time);
        if (info.state === "overdue") {
          synthetic.push({
            id: `synth-${m.id}`,
            status: "pending",
            due_at: info.dueAt.toISOString(),
            confirmed_at: null,
            resolved_at: null,
            video_url: null,
            photo1_url: null,
            photo2_url: null,
            med_name: m.med_name,
            patient_name: patientName,
            patient_phone: patientPhone,
          });
        }
      }

      const real: AlertRow[] = (data ?? []).map((r) => {
        const medRel = r.medications as { med_name: string } | { med_name: string }[] | null;
        const medName = Array.isArray(medRel) ? medRel[0]?.med_name : medRel?.med_name;
        return {
          id: r.id,
          status: r.status,
          due_at: r.due_at,
          confirmed_at: r.confirmed_at,
          resolved_at: r.resolved_at,
          video_url: r.video_url,
          photo1_url: r.photo1_url,
          photo2_url: r.photo2_url,
          med_name: medName ?? "Medication",
          patient_name: patientName,
          patient_phone: patientPhone,
        };
      });

      setRows([...synthetic, ...real]);
      setLoading(false);
    };
    load();
  }, [profile?.id, isSupervisor, selected?.id, reload]);

  const active = rows.filter(
    (r) => (r.status === "pending" || r.status === "missed") && !r.resolved_at,
  );
  const history = rows.filter((r) => r.status === "confirmed" || r.resolved_at);

  const resolve = async (id: string) => {
    if (id.startsWith("synth-")) {
      // Synthetic overdue alert — no DB row to resolve. Just hide locally.
      setRows((rs) => rs.filter((r) => r.id !== id));
      return;
    }
    const { error } = await supabase
      .from("medication_logs")
      .update({ resolved_at: new Date().toISOString(), resolved_by_supervisor_id: profile?.id ?? null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else setReload((r) => r + 1);
  };

  const videoUrl = async (path: string) => {
    const { data } = await supabase.storage.from("med-videos").createSignedUrl(path, 60);
    return data?.signedUrl ?? null;
  };
  const photoUrl = async (path: string) => {
    const { data } = await supabase.storage.from("med-photos").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "short", year: "numeric" });

  return (
    <AppShell title={t("alerts_title")}>
        {detail && (
          <DetailModal a={detail} onClose={() => setDetail(null)} photoUrl={photoUrl} videoUrl={videoUrl} fmtFull={fmtFull} />
        )}
      <div className="flex-1 px-4 pt-4 pb-24">
        {isSupervisor && <PatientSwitcher />}
        <div className="font-display text-fs-xl font-semibold mb-1">{t("alerts_title")}</div>
        <div className="text-fs-sm text-muted-foreground mb-4">
          {active.length} active · {history.length} history
        </div>

        {/* Emergency 999 — always available on Alerts */}
        <a
          href="tel:999"
          className="block w-full text-center bg-red text-white font-extrabold text-fs-base py-4 rounded-2xl shadow-[var(--shadow-ping)] mb-4 active:scale-[0.98] transition-transform"
        >
          {t("emergency_999")}
        </a>

        {isSupervisor && patients.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
            No linked patients yet. Use the Link tab to add one.
          </div>
        ) : loading ? (
          <div className="bg-card rounded-2xl p-6 border border-border text-center text-muted-foreground text-fs-sm">
            Loading…
          </div>
        ) : active.length === 0 && history.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
            {t("alerts_empty")}
          </div>
        ) : (
          <>
            {active.map((a) => (
              <ActiveCard key={a.id} a={a} fmt={fmt} resolve={resolve} videoUrl={videoUrl} t={t} />
            ))}
            {history.length > 0 && (
              <div className="mt-5">
                <div className="font-extrabold text-fs-sm mb-2 text-muted-foreground uppercase tracking-wider">
                  {t("alert_resolved")}
                </div>
                {history.slice(0, 20).map((a) => (
                  <HistoryCard key={a.id} a={a} fmtFull={fmtFull} t={t} onOpen={() => setDetail(a)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ActiveCard({
  a, fmt, resolve, videoUrl, t,
}: {
  a: AlertRow;
  fmt: (iso: string) => string;
  resolve: (id: string) => void;
  videoUrl: (path: string) => Promise<string | null>;
  t: (k: string) => string;
}) {
  const phone = (a.patient_phone || "").replace(/\s|-/g, "");
  const minsLate = Math.max(0, Math.round((Date.now() - new Date(a.due_at).getTime()) / 60000));
  const openVideo = async () => {
    if (!a.video_url) return;
    const url = await videoUrl(a.video_url);
    if (url) window.open(url, "_blank");
    else toast.error("Could not load video");
  };
  return (
    <div className="bg-red-l border border-red rounded-2xl p-4 mb-3 shadow-[var(--shadow-ping)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-extrabold text-fs-base text-red truncate">⚠️ {a.patient_name}</div>
          <div className="text-fs-sm text-foreground mt-0.5 truncate">{a.med_name}</div>
          <div className="text-fs-xs text-muted-foreground mt-1">
            {fmt(a.due_at)} · {minsLate}m {t("alert_overdue")}
          </div>
        </div>
        {a.video_url && (
          <button
            onClick={openVideo}
            className="bg-card text-foreground border border-border text-fs-xs font-bold px-2.5 py-1 rounded-full shrink-0"
          >
            🎥 Video
          </button>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 text-center bg-red text-white font-bold text-fs-xs py-2.5 rounded-xl"
          >
            📞 {t("alert_call")}
          </a>
        )}
        <button
          onClick={() => resolve(a.id)}
          className="flex-1 bg-card text-foreground border border-border font-bold text-fs-xs py-2.5 rounded-xl hover:bg-green-l hover:text-green hover:border-green transition-colors"
        >
          ✓ {t("alert_resolve")}
        </button>
      </div>
    </div>
  );
}

function HistoryCard({
  a, fmtFull, t, onOpen,
}: {
  a: AlertRow;
  fmtFull: (iso: string) => string;
  t: (k: string) => string;
  onOpen: () => void;
}) {
  const takenAt = a.confirmed_at ?? a.resolved_at ?? a.due_at;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-card rounded-xl p-3 mb-2 border border-border opacity-90 hover:bg-green-l/40 active:scale-[0.99] transition"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-fs-sm truncate">{a.med_name}</div>
          <div className="text-fs-xs text-muted-foreground">
            {a.status === "confirmed" ? "Taken at " : "Resolved at "} {fmtFull(takenAt)}
          </div>
        </div>
        <span className="bg-green-l text-green text-fs-xs font-bold px-2.5 py-1 rounded-full shrink-0">
          ✓ {a.status === "confirmed" ? "Taken" : t("alert_resolved")}
        </span>
      </div>
      <div className="text-fs-xs text-green font-bold mt-1.5">View details →</div>
    </button>
  );
}

function DetailModal({
  a, onClose, photoUrl, videoUrl, fmtFull,
}: {
  a: AlertRow;
  onClose: () => void;
  photoUrl: (path: string) => Promise<string | null>;
  videoUrl: (path: string) => Promise<string | null>;
  fmtFull: (iso: string) => string;
}) {
  const [p1, setP1] = useState<string | null>(null);
  const [p2, setP2] = useState<string | null>(null);
  const [vid, setVid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u1, u2, uv] = await Promise.all([
        a.photo1_url ? photoUrl(a.photo1_url) : Promise.resolve(null),
        a.photo2_url ? photoUrl(a.photo2_url) : Promise.resolve(null),
        a.video_url ? videoUrl(a.video_url) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setP1(u1); setP2(u2); setVid(uv);
    })();
    return () => { cancelled = true; };
  }, [a.photo1_url, a.photo2_url, a.video_url, photoUrl, videoUrl]);

  const takenAt = a.confirmed_at ?? a.resolved_at ?? a.due_at;

  return (
    <div className="fixed inset-0 bg-black/60 z-[500] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
        <div className="font-display text-fs-xl font-semibold mb-1">{a.med_name}</div>
        <div className="text-fs-xs text-muted-foreground mb-1">Patient: {a.patient_name}</div>
        <div className="text-fs-xs text-muted-foreground mb-1">Scheduled: {fmtFull(a.due_at)}</div>
        {a.confirmed_at && (
          <div className="text-fs-sm text-green font-bold mb-4">✓ Taken at {fmtFull(a.confirmed_at)}</div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-fs-xs font-bold text-muted-foreground mb-1.5">Photo 1 · Pill in hand</div>
            {p1 ? (
              <img src={p1} alt="Pill in hand" className="w-full rounded-xl border border-border object-cover aspect-square" />
            ) : (
              <div className="w-full aspect-square rounded-xl border border-border bg-input-bg flex items-center justify-center text-fs-xs text-muted-foreground">
                {a.photo1_url ? "Loading…" : "No photo"}
              </div>
            )}
          </div>
          <div>
            <div className="text-fs-xs font-bold text-muted-foreground mb-1.5">Photo 2 · Empty hand</div>
            {p2 ? (
              <img src={p2} alt="Empty hand" className="w-full rounded-xl border border-border object-cover aspect-square" />
            ) : (
              <div className="w-full aspect-square rounded-xl border border-border bg-input-bg flex items-center justify-center text-fs-xs text-muted-foreground">
                {a.photo2_url ? "Loading…" : "No photo"}
              </div>
            )}
          </div>
        </div>

        {vid && (
          <a href={vid} target="_blank" rel="noopener noreferrer" className="block text-center bg-input-bg border border-border rounded-xl py-2.5 font-bold text-fs-sm mb-3">
            🎥 Open video
          </a>
        )}

        <button onClick={onClose} className="w-full bg-green text-white font-bold py-3 rounded-xl">
          Close
        </button>
      </div>
    </div>
  );
}
