import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/ping/AppShell";
import { usePingStore, useT_hook, EVENT_COLOURS, DAYS_SHORT, MONS } from "@/store/usePingStore";
import type { CalEvent } from "@/store/usePingStore";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Family calendar — Ping" },
      { name: "description", content: "Shared family medication and appointment calendar." },
    ],
  }),
  component: Page,
});

function Page() {
  const t = useT_hook();
  const {
    user, elders, calViewDate, calSelDate, calEvents,
    setCalViewDate, setCalSelDate, addCalEvent, deleteCalEvent,
  } = usePingStore();
  const isSup = user?.role === "supervisor";

  const [showAdd, setShowAdd] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evElder, setEvElder] = useState(elders[0]?.name ?? "");
  const [evColor, setEvColor] = useState<string>(EVENT_COLOURS[0]);

  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const evByDate: Record<string, CalEvent[]> = {};
  calEvents.forEach((ev) => {
    (evByDate[ev.date] ||= []).push(ev);
  });
  const selEvents = calSelDate ? evByDate[calSelDate] || [] : [];
  const upcoming = [...calEvents].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e${i}`} className="min-h-[38px] opacity-0 pointer-events-none" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evs = evByDate[k] || [];
    const isT = k === todayKey;
    const isSel = k === calSelDate;
    cells.push(
      <button
        key={k}
        type="button"
        onClick={() => setCalSelDate(k)}
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
                style={{ background: ev.color }}
              />
            ))}
          </div>
        )}
      </button>,
    );
  }

  function openAdd() {
    setEvTitle("");
    setEvDate(calSelDate || todayKey);
    setEvElder(elders[0]?.name ?? "");
    setEvColor(EVENT_COLOURS[0]);
    setShowAdd(true);
  }

  function saveEvent() {
    addCalEvent({
      date: evDate || todayKey,
      title: evTitle || "New event",
      type: "doc",
      elder: evElder || elders[0]?.name || "",
      color: evColor,
    });
    setShowAdd(false);
  }

  function prevMonth() {
    const d = new Date(calViewDate);
    d.setMonth(d.getMonth() - 1);
    setCalViewDate(d);
  }
  function nextMonth() {
    const d = new Date(calViewDate);
    d.setMonth(d.getMonth() + 1);
    setCalViewDate(d);
  }

  const list = calSelDate ? selEvents : upcoming;

  return (
    <AppShell title={t("calendar_title")}>
      <div className="flex-1 px-4 pt-4 pb-24">
        <div className="bg-card rounded-2xl p-3.5 shadow-[var(--shadow-ping)] border border-border">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={prevMonth}
              className="w-9 h-9 rounded-full bg-transparent border-[1.5px] border-border text-muted-foreground hover:bg-green-l hover:border-green hover:text-green transition-colors text-lg leading-none"
            >
              ‹
            </button>
            <div className="font-display text-fs-lg font-semibold">
              {MONS[month]} {year}
            </div>
            <button
              onClick={nextMonth}
              className="w-9 h-9 rounded-full bg-transparent border-[1.5px] border-border text-muted-foreground hover:bg-green-l hover:border-green hover:text-green transition-colors text-lg leading-none"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-[2px] mb-[2px]">
            {DAYS_SHORT.map((d, i) => (
              <div key={i} className="text-center text-[0.72rem] font-extrabold text-hint uppercase py-[3px]">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-[2px]">{cells}</div>
        </div>

        <div className="flex items-center justify-between mt-5 mb-2">
          <div className="font-bold text-fs-sm">{calSelDate ? calSelDate : t("upcoming")}</div>
          {isSup && (
            <button
              onClick={openAdd}
              className="text-green font-bold text-fs-xs px-3 py-1.5 rounded-full hover:bg-green-l transition-colors"
            >
              {t("add_event")}
            </button>
          )}
        </div>

        {list.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground border border-border">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-fs-sm">{t("no_events_today")}</div>
          </div>
        ) : (
          list.map((ev) => (
            <div
              key={ev.id}
              className="bg-card rounded-xl p-3 mb-2 border border-border"
              style={{ borderLeft: `3px solid ${ev.color}` }}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-fs-sm">{ev.title}</div>
                  <div className="text-muted-foreground text-fs-xs">
                    {ev.elder} · {ev.date}
                  </div>
                </div>
                {isSup && (
                  <button
                    onClick={() => deleteCalEvent(ev.id)}
                    className="bg-transparent border-none text-hint hover:text-red text-base flex-shrink-0"
                    title="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && isSup && (
        <div
          className="fixed inset-0 bg-[var(--overlay)] z-[300] flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
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
            <Field label={t("event_for")}>
              <select
                value={evElder}
                onChange={(e) => setEvElder(e.target.value)}
                className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-sm focus:outline-none focus:border-green"
              >
                {elders.map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("colour_label")}>
              <div className="flex gap-[7px] flex-wrap mb-3">
                {EVENT_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEvColor(c)}
                    style={{ background: c }}
                    className={`w-[26px] h-[26px] rounded-full border-2 transition-transform hover:scale-110 ${
                      evColor === c ? "border-foreground" : "border-transparent"
                    }`}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
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
