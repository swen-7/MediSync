import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/ping/AppShell";
import { useT_hook, EVENT_COLOURS, DAYS_SHORT, MONS } from "@/store/usePingStore";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { usePatients } from "@/lib/patientContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Family calendar — Ping" },
      { name: "description", content: "Shared family medication and appointment calendar." },
    ],
  }),
  component: Page,
});

interface CalRow {
  id: string;
  patient_id: string;
  title: string;
  event_date: string; // ISO timestamptz
  created_by: string;
}

function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EVENT_COLOURS[h % EVENT_COLOURS.length];
}

function Page() {
  const t = useT_hook();
  const { profile, session } = useAuth();
  const { selected } = usePatients();
  const isSup = profile?.role === "supervisor";

  // Active patient context: supervisors use the selected patient, patients use themselves.
  const activePatientId = isSup ? selected?.id ?? null : profile?.id ?? null;

  const [events, setEvents] = useState<CalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selDate, setSelDate] = useState<string | null>(null);

  const todayKey = toDateKey(new Date().toISOString());

  const reload = useCallback(async () => {
    if (!activePatientId) { setEvents([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, patient_id, title, event_date, created_by")
      .eq("patient_id", activePatientId)
      .order("event_date", { ascending: true });
    if (error) toast.error(error.message);
    setEvents((data ?? []) as CalRow[]);
    setLoading(false);
  }, [activePatientId]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime: refresh on any change to this patient's events.
  useEffect(() => {
    if (!activePatientId) return;
    const channel = supabase
      .channel(`cal_events_${activePatientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events", filter: `patient_id=eq.${activePatientId}` },
        () => { reload(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activePatientId, reload]);

  const [showAdd, setShowAdd] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState("");

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const evByDate: Record<string, CalRow[]> = {};
  events.forEach((ev) => {
    const k = toDateKey(ev.event_date);
    (evByDate[k] ||= []).push(ev);
  });

  const selEvents = selDate ? evByDate[selDate] || [] : [];
  const upcoming = [...events]
    .filter((e) => e.event_date >= new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .slice(0, 7);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e${i}`} className="min-h-[38px] opacity-0 pointer-events-none" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evs = evByDate[k] || [];
    const isT = k === todayKey;
    const isSel = k === selDate;
    cells.push(
      <button
        key={k}
        type="button"
        onClick={() => setSelDate(k)}
        className={`min-h-[38px] rounded-[7px] flex flex-col items-center justify-start pt-[5px] cursor-pointer relative text-[0.85rem] font-bold transition-colors ${
          isT ? "bg-green text-white" : "text-foreground hover:bg-green-l"
        } ${isSel && !isT ? "outline outline-2 outline-green outline-offset-1" : ""}`}
      >
        <span>{d}</span>
        {evs.length > 0 && (
          <div className="flex gap-[2px] flex-wrap justify-center py-[2px]">
            {evs.slice(0, 4).map((ev) => (
              <div
                key={ev.id}
                className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                style={{ background: colorForId(ev.id) }}
              />
            ))}
          </div>
        )}
      </button>,
    );
  }

  function openAdd() {
    setEvTitle("");
    setEvDate(selDate || todayKey);
    setShowAdd(true);
  }

  async function saveEvent() {
    if (!activePatientId || !session?.user?.id) return;
    const title = evTitle.trim() || "New event";
    const dateStr = evDate || todayKey;
    // Save at noon local to avoid timezone day-shift.
    const iso = new Date(`${dateStr}T12:00:00`).toISOString();
    const { error } = await supabase
      .from("calendar_events")
      .insert({
        patient_id: activePatientId,
        created_by: session.user.id,
        title,
        event_date: iso,
      });
    if (error) return toast.error(error.message);
    toast.success("Event added");
    setShowAdd(false);
    reload();
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function prevMonth() { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); setSelDate(null); }
  function nextMonth() { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d); setSelDate(null); }

  const list = selDate ? selEvents : upcoming;
  const canAdd = !!activePatientId; // both supervisors (for selected patient) and patients can add
  const emptyMsg = isSup
    ? "No upcoming events scheduled. Click '+' to add an appointment or reminder."
    : "No upcoming events scheduled.";

  return (
    <AppShell title={t("calendar_title")}>
      <div className="flex-1 px-4 pt-4 pb-24">
        {!activePatientId ? (
          <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground border border-border">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-fs-sm">
              {isSup ? "Link a patient to view their calendar." : "Loading…"}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-2xl p-3.5 shadow-[var(--shadow-ping)] border border-border">
              <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonth} className="w-9 h-9 rounded-full bg-transparent border-[1.5px] border-border text-muted-foreground hover:bg-green-l hover:border-green hover:text-green transition-colors text-lg leading-none">‹</button>
                <div className="font-display text-fs-lg font-semibold">{MONS[month]} {year}</div>
                <button onClick={nextMonth} className="w-9 h-9 rounded-full bg-transparent border-[1.5px] border-border text-muted-foreground hover:bg-green-l hover:border-green hover:text-green transition-colors text-lg leading-none">›</button>
              </div>
              <div className="grid grid-cols-7 gap-[2px] mb-[2px]">
                {DAYS_SHORT.map((d, i) => (
                  <div key={i} className="text-center text-[0.72rem] font-extrabold text-hint uppercase py-[3px]">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[2px]">{cells}</div>
            </div>

            <div className="flex items-center justify-between mt-5 mb-2">
              <div className="font-bold text-fs-sm">{selDate ? selDate : t("upcoming")}</div>
              {canAdd && (
                <button onClick={openAdd} className="text-green font-bold text-fs-xs px-3 py-1.5 rounded-full hover:bg-green-l transition-colors">
                  {t("add_event")}
                </button>
              )}
            </div>

            {loading ? (
              <div className="bg-card rounded-2xl p-5 text-center text-muted-foreground text-fs-sm border border-border">Loading…</div>
            ) : list.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground border border-border">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-fs-sm">{selDate ? t("no_events_today") : emptyMsg}</div>
              </div>
            ) : (
              list.map((ev) => {
                const canDelete = isSup || ev.created_by === session?.user?.id;
                return (
                  <div
                    key={ev.id}
                    className="bg-card rounded-xl p-3 mb-2 border border-border"
                    style={{ borderLeft: `3px solid ${colorForId(ev.id)}` }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-fs-sm">{ev.title}</div>
                        <div className="text-muted-foreground text-fs-xs">{toDateKey(ev.event_date)}</div>
                      </div>
                      {canDelete && (
                        <button onClick={() => deleteEvent(ev.id)} className="bg-transparent border-none text-hint hover:text-red text-base flex-shrink-0" title="Delete">✕</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {showAdd && canAdd && (
        <div
          className="fixed inset-0 bg-[var(--overlay)] z-[300] flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div className="bg-card rounded-t-[20px] p-5 w-full max-w-[480px] max-h-[85vh] overflow-y-auto">
            <div className="w-9 h-1 bg-border rounded mx-auto mb-5" />
            <div className="font-extrabold text-fs-lg mb-4">{t("add_event")}</div>

            <Field label={t("event_title")}>
              <input
                type="text"
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="e.g. Cardiologist appointment"
                className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-sm focus:outline-none focus:border-green"
              />
            </Field>
            <Field label={t("event_date")}>
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-sm focus:outline-none focus:border-green"
              />
            </Field>

            <button
              onClick={saveEvent}
              className="w-full bg-green text-white font-bold py-3 rounded-xl mb-2 hover:opacity-90 transition-opacity"
            >
              {t("save_event")}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="w-full bg-transparent border-[1.5px] border-border text-muted-foreground font-bold py-3 rounded-xl hover:bg-green-l hover:border-green hover:text-green transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-fs-xs font-bold text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
