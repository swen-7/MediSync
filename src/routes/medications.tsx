import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ping/AppShell";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/lib/patientContext";
import { MY_MEDS, FREQUENCIES, UNITS, type MedSuggestion } from "@/lib/malaysianMeds";
import { PatientSwitcher } from "@/components/ping/PatientSwitcher";
import { useTimeFormat, formatScheduledTime } from "@/store/usePingStore";

export const Route = createFileRoute("/medications")({
  head: () => ({
    meta: [
      { title: "Medications — MediSync" },
      { name: "description", content: "Manage medications, dosages, and refills." },
    ],
  }),
  component: MedsPage,
});

interface Med {
  id: string;
  patient_id: string;
  med_name: string;
  dosage: string;
  frequency: string;
  scheduled_time: string;
  total_qty: number;
  remaining_qty: number;
  refill_reminder_days: number;
  unit: string;
  active: boolean;
}

function MedsPage() {
  const { profile, session, loading } = useAuth();
  const navigate = useNavigate();
  const { selected } = usePatients();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // Effective patient id: caregivers use the selected linked patient, patients use themselves.
  const patientId =
    profile?.role === "patient" ? profile.id : selected?.id ?? null;

  const [meds, setMeds] = useState<Med[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Med | "new" | null>(null);

  const load = async () => {
    if (!patientId) {
      setMeds([]);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("patient_id", patientId)
      .eq("active", true)
      .order("scheduled_time");
    if (error) toast.error(error.message);
    setMeds((data ?? []) as Med[]);
    setBusy(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const remove = async (id: string) => {
    if (!confirm("Delete this medication?")) return;
    const { error } = await supabase.from("medications").update({ active: false }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    load();
  };

  const isSupervisor = profile?.role === "supervisor";

  return (
    <AppShell title="Medications">
      <div className="flex-1 px-4 pt-4 pb-24">
        {isSupervisor && <PatientSwitcher />}

        {!patientId ? (
          <EmptyNoPatient />
        ) : (
          <>
            <div className="flex items-center justify-between mb-2.5">
              <div className="font-extrabold text-fs-sm">
                {meds.length} medication{meds.length === 1 ? "" : "s"}
              </div>
              <button
                onClick={() => setEditing("new")}
                className="bg-green text-white font-bold py-2 px-4 rounded-xl text-fs-xs"
              >
                + Add
              </button>
            </div>

            {busy && meds.length === 0 ? (
              <div className="text-center text-muted-foreground text-fs-sm py-8">Loading…</div>
            ) : meds.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 border border-border text-center text-muted-foreground text-fs-sm">
                No medications yet. Tap + Add to register one.
              </div>
            ) : (
              meds.map((m) => (
                <MedCard key={m.id} med={m} onEdit={() => setEditing(m)} onDelete={() => remove(m.id)} />
              ))
            )}
          </>
        )}
      </div>

      {editing && patientId && (
        <MedEditor
          patientId={patientId}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function EmptyNoPatient() {
  return (
    <div className="bg-amber-l border border-amber rounded-2xl p-5 text-center">
      <div className="text-2xl mb-2">🔗</div>
      <div className="font-bold text-amber mb-1">No patient linked</div>
      <div className="text-fs-xs text-muted-foreground">
        Go to <strong>Link</strong> and enter a patient's 6-digit invite code to start.
      </div>
    </div>
  );
}

function MedCard({
  med,
  onEdit,
  onDelete,
}: {
  med: Med;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const timeFmt = useTimeFormat();
  const dosesPerDay = freqToDoses(med.frequency);
  const daysLeft = dosesPerDay > 0 ? Math.floor(med.remaining_qty / dosesPerDay) : null;
  const needsRefill = daysLeft !== null && daysLeft <= med.refill_reminder_days;
  return (
    <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-fs-base truncate">{med.med_name}</div>
          <div className="text-fs-xs text-muted-foreground mt-0.5">
            {med.dosage} · {med.frequency} · {formatScheduledTime(med.scheduled_time, timeFmt)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${
                needsRefill ? "bg-amber-l text-amber" : "bg-teal-l text-teal"
              }`}
            >
              {med.remaining_qty} {med.unit} left
              {daysLeft !== null && ` · ~${daysLeft}d`}
            </span>
            {needsRefill && (
              <span className="text-[0.7rem] font-bold text-amber">⚠ Refill soon</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="text-fs-xs font-bold text-green bg-green-l px-3 py-1.5 rounded-lg"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-fs-xs font-bold text-muted-foreground hover:text-red px-3 py-1.5 rounded-lg"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function freqToDoses(f: string): number {
  if (f === "Twice daily") return 2;
  if (f === "Three times daily") return 3;
  if (f === "Four times daily") return 4;
  if (f === "Every other day") return 0.5;
  if (f === "As needed") return 0;
  return 1;
}

function fmtTime(t: string) {
  // t = "HH:MM:SS" — render as "HH:MM"
  return (t || "").slice(0, 5);
}

function MedEditor({
  patientId,
  initial,
  onClose,
  onSaved,
}: {
  patientId: string;
  initial: Med | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.med_name ?? "");
  const [dosage, setDosage] = useState(initial?.dosage ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "pills");
  const [freq, setFreq] = useState(initial?.frequency ?? "Once daily");
  const [time, setTime] = useState(fmtTime(initial?.scheduled_time ?? "08:00:00"));
  const [totalQty, setTotalQty] = useState(String(initial?.total_qty ?? 30));
  const [remainingQty, setRemainingQty] = useState(String(initial?.remaining_qty ?? 30));
  const [refillDays, setRefillDays] = useState(String(initial?.refill_reminder_days ?? 7));
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const pickSuggestion = (s: MedSuggestion) => {
    setName(s.name);
    setDosage(s.dosage);
    setUnit(s.unit);
    setShowPicker(false);
  };

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Name too short");
      return;
    }
    const total = parseInt(totalQty, 10);
    const remaining = parseInt(remainingQty, 10);
    const refill = parseInt(refillDays, 10);
    if (!Number.isFinite(total) || total < 1 || total > 9999) {
      toast.error("Invalid total quantity");
      return;
    }
    if (!Number.isFinite(remaining) || remaining < 0 || remaining > total) {
      toast.error("Remaining must be 0–total");
      return;
    }
    setBusy(true);
    const payload = {
      patient_id: patientId,
      med_name: name.trim(),
      dosage: dosage.trim(),
      frequency: freq,
      scheduled_time: `${time}:00`,
      total_qty: total,
      remaining_qty: remaining,
      refill_reminder_days: Number.isFinite(refill) ? refill : 7,
      unit,
      active: true,
    };
    const { error } = initial
      ? await supabase.from("medications").update(payload).eq("id", initial.id)
      : await supabase.from("medications").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(initial ? "Updated" : "Added");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[400] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 pb-8 shadow-[0_-4px_24px_rgba(0,0,0,0.2)] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
        <div className="font-display text-fs-xl font-semibold mb-4">
          {initial ? "Edit medication" : "Add medication"}
        </div>

        <Field label="Medication">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amlodipine 5mg"
              className={inp}
            />
            <button
              onClick={() => setShowPicker(true)}
              className="bg-green-l text-green font-bold px-3 rounded-xl text-fs-xs whitespace-nowrap"
            >
              🔎 Common
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Dosage">
            <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="5mg" className={inp} />
          </Field>
          <Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inp}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Frequency">
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className={inp}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inp} />
        </Field>

        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Total qty">
            <input
              type="number"
              inputMode="numeric"
              value={totalQty}
              onChange={(e) => setTotalQty(e.target.value)}
              className={inp}
            />
          </Field>
          <Field label="Remaining">
            <input
              type="number"
              inputMode="numeric"
              value={remainingQty}
              onChange={(e) => setRemainingQty(e.target.value)}
              className={inp}
            />
          </Field>
          <Field label="Refill at (days)">
            <input
              type="number"
              inputMode="numeric"
              value={refillDays}
              onChange={(e) => setRefillDays(e.target.value)}
              className={inp}
            />
          </Field>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 bg-input-bg text-foreground font-bold py-3 rounded-xl">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {showPicker && <MedPicker onPick={pickSuggestion} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

function MedPicker({
  onPick,
  onClose,
}: {
  onPick: (s: MedSuggestion) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MY_MEDS;
    return MY_MEDS.filter(
      (m) => m.name.toLowerCase().includes(s) || m.group.toLowerCase().includes(s),
    );
  }, [q]);

  const grouped = useMemo(() => {
    const m = new Map<string, MedSuggestion[]>();
    for (const s of filtered) {
      const arr = m.get(s.group) ?? [];
      arr.push(s);
      m.set(s.group, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[500] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-card w-full max-w-[480px] rounded-t-3xl p-5 pb-6 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-3" />
        <div className="font-display text-fs-lg font-semibold mb-2">Common medications (MY)</div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or group…"
          className={`${inp} mb-3`}
        />
        <div className="overflow-y-auto -mx-2 px-2">
          {grouped.length === 0 && (
            <div className="text-center text-muted-foreground text-fs-sm py-6">
              No matches. Type your own in the Add screen.
            </div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="text-fs-xs font-extrabold text-hint uppercase tracking-wider px-1 mb-1">
                {group}
              </div>
              {items.map((s) => (
                <button
                  key={s.name}
                  onClick={() => onPick(s)}
                  className="w-full text-left px-3 py-3 rounded-xl border border-border bg-input-bg hover:bg-green-l hover:border-green mb-1.5 transition-colors"
                >
                  <div className="font-bold text-fs-sm">{s.name}</div>
                  <div className="text-fs-xs text-muted-foreground mt-0.5">
                    {s.dosage} · {s.unit}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inp =
  "w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-base focus:outline-none focus:border-green";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="block text-fs-xs font-extrabold text-hint mb-1 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}