import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useT_hook, useTimeFormat, formatScheduledTime } from "@/store/usePingStore";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useLocation } from "@tanstack/react-router";
import { computeWindow, parseScheduled } from "@/lib/dueLogic";
import { DueTakeover } from "@/components/ping/DueTakeover";
import { useRoleGuard } from "@/lib/roleGuard";
import { evaluateStreak } from "@/lib/streak";
import { subscribeUserToPush } from "@/lib/push";

interface DbVital {
  id: string;
  blood_pressure_sys: number | null;
  blood_pressure_dia: number | null;
  pulse: number | null;
  blood_glucose: number | null;
  taken_at: string;
  note: string | null;
}

export const Route = createFileRoute("/my-meds")({
  head: () => ({
    meta: [
      { title: "My Meds — MediSync" },
      { name: "description", content: "Your medications, vitals, and emergency contacts." },
    ],
  }),
  component: Page,
});

function sanitizeForWhatsApp(raw: string): string {
  const digits = (raw || "").replace(/\D+/g, "");
  return digits.replace(/^0+/, "");
}

function bpCategory(sys: number | null, dia: number | null): { key: string; cls: string } | null {
  if (sys == null || dia == null) return null;
  if (sys >= 140 || dia >= 90) return { key: "vitals_high", cls: "bg-red-l text-red" };
  if (sys >= 130 || dia >= 80) return { key: "vitals_elevated", cls: "bg-amber-l text-amber" };
  return { key: "vitals_normal", cls: "bg-green-l text-green" };
}

function glucoseCategory(g: number | null): { key: string; cls: string } | null {
  if (g == null) return null;
  if (g >= 7.0) return { key: "vitals_diabetes", cls: "bg-red-l text-red" };
  if (g >= 5.6) return { key: "vitals_prediabetes", cls: "bg-amber-l text-amber" };
  return { key: "vitals_normal", cls: "bg-green-l text-green" };
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-MY", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

interface MyMed {
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

function Page() {
  const t = useT_hook();
  const timeFmt = useTimeFormat();
  const location = useLocation();
  useRoleGuard(location.pathname);
  const { profile } = useAuth();
  const [meds, setMeds] = useState<MyMed[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date>(() => new Date());
  const [reload, setReload] = useState(0);
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [vitals, setVitals] = useState<DbVital[]>([]);
  const [streak, setStreak] = useState(0);
  const [streakDoneToday, setStreakDoneToday] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [{ data: medsData, error }, { data: logsData }, { data: vitalsData }, { data: settings }] = await Promise.all([
        supabase
          .from("medications")
          .select("id, med_name, dosage, frequency, scheduled_time, remaining_qty, refill_reminder_days, unit")
          .eq("patient_id", profile.id).eq("active", true).order("scheduled_time"),
        supabase
          .from("medication_logs")
          .select("medication_id, due_at")
          .eq("patient_id", profile.id).gte("due_at", startOfDay.toISOString()),
        supabase
          .from("vitals")
          .select("id, blood_pressure_sys, blood_pressure_dia, pulse, blood_glucose, taken_at, note")
          .eq("patient_id", profile.id).order("taken_at", { ascending: false }).limit(20),
        supabase
          .from("patient_settings")
          .select("caregiver_phone")
          .eq("patient_id", profile.id).maybeSingle(),
      ]);
      if (error) toast.error(error.message);
      setMeds((medsData ?? []) as MyMed[]);
      setLoggedToday(new Set((logsData ?? []).map((l) => l.medication_id)));
      setVitals((vitalsData ?? []) as DbVital[]);
      setSupervisorPhone(settings?.caregiver_phone ?? "");
      setLoading(false);

      // Streak evaluation runs in background after page load
      evaluateStreak(profile.id).then((s) => {
        setStreak(s.current_streak);
        setStreakDoneToday(s.fully_done_today);
      }).catch(() => {});
    };
    load();
  }, [profile?.id, reload]);

  // Local clock tick every 30s — works offline, drives DueTakeover even without network
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Patient opts into background push once on the dashboard.
  useEffect(() => {
    if (profile?.id) {
      subscribeUserToPush(profile.id).catch(() => {});
    }
  }, [profile?.id]);

  const dueMed = (() => {
    let best: { med: MyMed; info: ReturnType<typeof computeWindow> } | null = null;
    for (const m of meds) {
      if (loggedToday.has(m.id)) continue;
      const info = computeWindow(now, m.scheduled_time);
      if (info.state === "idle") continue;
      if (!best || parseScheduled(m.scheduled_time, now) < parseScheduled(best.med.scheduled_time, now)) {
        best = { med: m, info };
      }
    }
    return best;
  })();

  const waNumber = sanitizeForWhatsApp(supervisorPhone);
  const waUrl = `https://wa.me/${waNumber}`;
  const openWa = () => window.open(waUrl, "_blank", "noopener,noreferrer");
  const [showVitals, setShowVitals] = useState(false);

  const lowStock = meds.filter((m) => {
    const d = freqDoses(m.frequency);
    if (d <= 0) return false;
    return Math.floor(m.remaining_qty / d) <= m.refill_reminder_days;
  });

  const [showAddMed, setShowAddMed] = useState(false);

  return (
    <AppShell title={t("my_meds")}>
      <div className="flex-1 px-4 pt-4 pb-24">
        {/* Streak badge */}
        <div className={`rounded-2xl p-4 mb-4 border-2 ${streak > 0 ? "bg-amber-l border-amber" : "bg-card border-border"}`}>
          <div className="flex items-center gap-3">
            <div className="text-3xl">{streak > 0 ? "🔥" : "✨"}</div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-fs-base">
                {streak > 0 ? `${streak} ${t("streak_title")}` : t("streak_start")}
              </div>
              <div className="text-fs-xs text-muted-foreground">
                {streak > 0 ? t("streak_great") : ""}
                {streakDoneToday && " ✓"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <a href="tel:999" className="text-center bg-red text-white font-extrabold text-fs-sm py-4 rounded-2xl shadow-[var(--shadow-ping)] active:scale-[0.98] transition-transform">
            {t("emergency_999")}
          </a>
          <button onClick={openWa} className="text-center bg-green text-white font-extrabold text-fs-sm py-4 rounded-2xl shadow-[var(--shadow-ping)] active:scale-[0.98] transition-transform">
            {t("contact_caregiver")}
          </button>
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <div className="font-extrabold text-fs-sm">{t("medications")}</div>
          <button
            onClick={() => setShowAddMed(true)}
            className="text-green text-fs-xs font-bold bg-transparent border-none px-2 py-1 rounded-lg hover:bg-green-l"
          >
            + {t("meds_add")}
          </button>
        </div>
        {lowStock.length > 0 && (
          <div className="bg-amber-l border border-amber rounded-xl p-3 mb-2.5 text-fs-xs font-bold text-amber">
            ⚠ {t("refill_warning")} {lowStock.map((m) => m.med_name).join(", ")}
          </div>
        )}
        {loading ? (
          <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm mb-4">{t("settings_loading")}</div>
        ) : meds.length === 0 ? (
          <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm mb-4">
            {t("empty_no_meds")}{" "}
            <Link to="/medications" className="text-green font-bold underline">
              {t("empty_add_one")}
            </Link>
            .
          </div>
        ) : (
          meds.map((m) => {
            const d = freqDoses(m.frequency);
            const daysLeft = d > 0 ? Math.floor(m.remaining_qty / d) : null;
            const low = daysLeft !== null && daysLeft <= m.refill_reminder_days;
            return (
              <div key={m.id} className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-fs-base truncate">{m.med_name}</div>
                    <div className="text-fs-xs text-muted-foreground mt-0.5">{m.frequency} · {formatScheduledTime(m.scheduled_time, timeFmt)}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-fs-xs font-bold shrink-0 ${low ? "bg-amber-l text-amber" : "bg-teal-l text-teal"}`}>
                    {m.remaining_qty} {m.unit}
                  </span>
                </div>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between mt-5 mb-2.5">
          <div className="font-extrabold text-fs-sm">{t("vitals_title")}</div>
          <button onClick={() => setShowVitals(true)} className="text-green text-fs-xs font-bold bg-transparent border-none px-2 py-1 rounded-lg hover:bg-green-l">
            {t("vitals_add")}
          </button>
        </div>

        {vitals.length === 0 ? (
          <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm">
            {t("vitals_empty")}
          </div>
        ) : (
          vitals.map((v) => <VitalCard key={v.id} v={v} />)
        )}
      </div>

      {showVitals && (
        <AddVitalModal
          onClose={() => setShowVitals(false)}
          onSave={async (v) => {
            if (!profile?.id) return;
            const { data, error } = await supabase
              .from("vitals")
              .insert({
                patient_id: profile.id,
                blood_pressure_sys: v.systolic ?? null,
                blood_pressure_dia: v.diastolic ?? null,
                pulse: v.pulse ?? null,
                blood_glucose: v.glucose ?? null,
                note: v.note ?? null,
                taken_at: v.takenAt,
              })
              .select("id, blood_pressure_sys, blood_pressure_dia, pulse, blood_glucose, taken_at, note")
              .single();
            if (error) return toast.error(error.message);
            if (data) setVitals((prev) => [data as DbVital, ...prev]);
            setShowVitals(false);
            toast.success("Reading saved");
          }}
        />
      )}

      {dueMed && (
        <DueTakeover
          med={dueMed.med}
          state={dueMed.info.state}
          dueAt={dueMed.info.dueAt}
          minutesDelta={dueMed.info.minutesDelta}
          onResolved={() => setReload((r) => r + 1)}
        />
      )}

      {showAddMed && profile?.id && (
        <AddMedModal
          patientId={profile.id}
          onClose={() => setShowAddMed(false)}
          onSaved={() => {
            setShowAddMed(false);
            setReload((r) => r + 1);
          }}
        />
      )}
    </AppShell>
  );
}

function VitalCard({ v }: { v: DbVital }) {
  const t = useT_hook();
  const bp = bpCategory(v.blood_pressure_sys, v.blood_pressure_dia);
  const gl = glucoseCategory(v.blood_glucose);
  return (
    <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {v.blood_pressure_sys != null && v.blood_pressure_dia != null && (
            <div className="flex items-baseline gap-1">
              <span className="font-display text-fs-xl font-semibold">{v.blood_pressure_sys}</span>
              <span className="text-muted-foreground font-bold">/</span>
              <span className="font-display text-fs-xl font-semibold">{v.blood_pressure_dia}</span>
              <span className="text-fs-xs text-muted-foreground ml-1">{t("vitals_unit")}</span>
            </div>
          )}
          {v.blood_glucose != null && (
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-fs-xs text-muted-foreground">🩸 {t("vitals_glucose")}:</span>
              <span className="font-display text-fs-lg font-semibold">{v.blood_glucose}</span>
              <span className="text-fs-xs text-muted-foreground">{t("vitals_glucose_unit")}</span>
            </div>
          )}
          {v.pulse != null && (
            <div className="text-fs-xs text-muted-foreground mt-0.5">❤️ {v.pulse} bpm</div>
          )}
          <div className="text-fs-xs text-muted-foreground mt-1">{fmtDateTime(v.taken_at)}</div>
          {v.note && <div className="text-fs-xs text-foreground mt-1 italic">"{v.note}"</div>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {bp && <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${bp.cls}`}>BP: {t(bp.key)}</span>}
          {gl && <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${gl.cls}`}>🩸 {t(gl.key)}</span>}
        </div>
      </div>
    </div>
  );
}

function AddVitalModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (v: { systolic?: number; diastolic?: number; pulse?: number; glucose?: number; takenAt: string; note?: string }) => void;
}) {
  const t = useT_hook();
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [glucose, setGlucose] = useState("");
  const [note, setNote] = useState("");

  const sysN = parseInt(sys, 10);
  const diaN = parseInt(dia, 10);
  const glN = parseFloat(glucose);
  const bpValid = !sys && !dia ? true : (sysN >= 60 && sysN <= 250 && diaN >= 30 && diaN <= 160);
  const glValid = !glucose ? true : (Number.isFinite(glN) && glN > 0 && glN < 50);
  const hasAny = !!sys || !!dia || !!glucose;
  const valid = bpValid && glValid && hasAny;

  const glCat = glucoseCategory(Number.isFinite(glN) ? glN : null);

  return (
    <div className="fixed inset-0 bg-black/50 z-[400] flex items-end justify-center" onClick={onClose}>
      <div className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 pb-8 shadow-[0_-4px_24px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
        <div className="font-display text-fs-xl font-semibold mb-4">{t("vitals_title")}</div>

        <div className="font-extrabold text-fs-xs text-muted-foreground mb-2 uppercase tracking-wider">{t("vitals_bp")}</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-fs-xs font-bold text-muted-foreground">{t("vitals_systolic")}</span>
            <input type="number" inputMode="numeric" value={sys} onChange={(e) => setSys(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-3 text-fs-lg font-extrabold text-center" placeholder="120" />
          </label>
          <label className="block">
            <span className="text-fs-xs font-bold text-muted-foreground">{t("vitals_diastolic")}</span>
            <input type="number" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-3 text-fs-lg font-extrabold text-center" placeholder="80" />
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-fs-xs font-bold text-muted-foreground">{t("vitals_pulse")}</span>
          <input type="number" inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5" placeholder="72" />
        </label>

        <div className="font-extrabold text-fs-xs text-muted-foreground mb-2 mt-4 uppercase tracking-wider">🩸 {t("vitals_glucose")}</div>
        <label className="block mb-2">
          <span className="text-fs-xs font-bold text-muted-foreground">{t("vitals_glucose_optional")}</span>
          <input
            type="number" step="0.1" inputMode="decimal" value={glucose}
            onChange={(e) => setGlucose(e.target.value)}
            className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5"
            placeholder="5.4"
          />
        </label>
        {glCat && (
          <div className="mb-3">
            <span className={`inline-block px-2.5 py-1 rounded-full text-fs-xs font-bold ${glCat.cls}`}>
              {t(glCat.key)} ({glN} {t("vitals_glucose_unit")})
            </span>
          </div>
        )}

        <label className="block mb-4">
          <span className="text-fs-xs font-bold text-muted-foreground">{t("vitals_note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5" placeholder="Before breakfast" />
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-input-bg text-foreground font-bold py-3 rounded-xl">{t("cancel")}</button>
          <button
            disabled={!valid}
            onClick={() => onSave({
              systolic: sys ? sysN : undefined,
              diastolic: dia ? diaN : undefined,
              pulse: pulse ? parseInt(pulse, 10) : undefined,
              glucose: glucose ? glN : undefined,
              takenAt: new Date().toISOString(),
              note: note.trim() || undefined,
            })}
            className="flex-1 bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {t("vitals_save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMedModal({
  patientId,
  onClose,
  onSaved,
}: {
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT_hook();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [qty, setQty] = useState("30");
  const [busy, setBusy] = useState(false);

  // Keep the times[] length in sync with the chosen frequency.
  useEffect(() => {
    const need = Math.max(1, freqDoses(frequency) || 1);
    setTimes((prev) => {
      if (prev.length === need) return prev;
      const defaults = ["08:00", "13:00", "19:00", "22:00"];
      const next = Array.from({ length: need }, (_, i) => prev[i] ?? defaults[i] ?? "08:00");
      return next;
    });
  }, [frequency]);

  const valid =
    name.trim().length > 0 &&
    Number(qty) > 0 &&
    times.every((tm) => /^\d{2}:\d{2}$/.test(tm));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const total = Math.max(1, parseInt(qty, 10));
    // Spread `total` quantity across all dose rows so existing per-row
    // remaining-qty logic stays consistent.
    const perRowTotal = Math.max(1, Math.ceil(total / times.length));
    const rows = times.map((tm) => ({
      patient_id: patientId,
      med_name: name.trim(),
      dosage: dosage.trim(),
      frequency,
      scheduled_time: `${tm}:00`,
      total_qty: perRowTotal,
      remaining_qty: perRowTotal,
      active: true,
    }));
    const { error } = await supabase.from("medications").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Medication added");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[400] flex items-end justify-center" onClick={onClose}>
      <div className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 pb-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
        <div className="font-display text-fs-xl font-semibold mb-4">{t("meds_add")}</div>

        <label className="block mb-3">
          <span className="text-fs-xs font-bold text-muted-foreground">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5" placeholder="e.g. Amlodipine 5mg" />
        </label>

        <label className="block mb-3">
          <span className="text-fs-xs font-bold text-muted-foreground">Dosage</span>
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5" placeholder="e.g. 1 tablet" />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-fs-xs font-bold text-muted-foreground">Frequency</span>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5">
              <option>Once daily</option>
              <option>Twice daily</option>
              <option>Three times daily</option>
              <option>Four times daily</option>
              <option>As needed</option>
            </select>
          </label>
          <label className="block">
            <span className="text-fs-xs font-bold text-muted-foreground">Quantity</span>
            <input type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full bg-input-bg border border-border rounded-xl px-3 py-2.5" />
          </label>
        </div>

        <div className="mb-4">
          <div className="text-fs-xs font-bold text-muted-foreground mb-1">
            Times {times.length > 1 ? `(${times.length} doses)` : ""}
          </div>
          <div className="space-y-2">
            {times.map((tm, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-fs-xs text-muted-foreground w-14 shrink-0">Dose {i + 1}</span>
                <input
                  type="time"
                  value={tm}
                  onChange={(e) =>
                    setTimes((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                  className="flex-1 bg-input-bg border border-border rounded-xl px-3 py-2.5"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-input-bg text-foreground font-bold py-3 rounded-xl">{t("cancel")}</button>
          <button disabled={!valid || busy} onClick={save} className="flex-1 bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50">
            {busy ? "Saving…" : t("save_event").replace("event", "medication") || "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
