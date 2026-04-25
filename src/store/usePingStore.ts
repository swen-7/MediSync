import { create } from "zustand";
import type { Lang } from "@/lib/translations";

export type Role = "supervisor" | "elderly";
export type Status = "confirmed" | "missed" | "pending";
export type TimeFormat = "12h" | "24h";

const LS_LANG = "medisync.lang";
const LS_TIMEFMT = "medisync.timeFormat";
const LS_THEME = "medisync.theme";

function readLS<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  freq: string;
  time: string;
  customDays: number[];
  totalQty: number;
  remainingQty: number;
  refillAlertDays: number;
  pillImg: string | null;
  unit: string;
}

export interface Elder {
  id: number;
  name: string;
  age: number;
  phone: string;
  email: string;
  timezone: string;
  status: Status;
  pdpaConsent: boolean;
  medications: Medication[];
}

export interface AlertItem {
  id: number;
  elderName: string;
  elderMed: string;
  time: string;
  ago: string;
  resolved: boolean;
}

export interface User {
  name: string;
  role: Role;
}

export interface VitalReading {
  id: number;
  systolic: number;
  diastolic: number;
  pulse?: number;
  takenAt: string; // ISO
  note?: string;
}

export interface SupervisorRate {
  name: string;
  rate: number;
}

export interface CalEvent {
  id: number;
  date: string; // YYYY-MM-DD
  title: string;
  type: "doc" | "medexp" | "med_schedule" | "other";
  elder: string;
  color: string;
}

export const EVENT_COLOURS = [
  "#1890a0", "#2a9d6e", "#e05555", "#d98f20", "#7c3aed",
  "#e57373", "#4caf50", "#2196f3", "#ff7043", "#8d6e63",
];

export const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
export const MONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface UndoState {
  msg: string;
  undo: () => void;
}

interface PingState {
  theme: "light" | "dark";
  lang: Lang;
  timeFormat: TimeFormat;
  user: User | null;
  loginRole: Role;
  loginMode: "login" | "signup";
  elders: Elder[];
  alerts: AlertItem[];
  hist7: Status[];
  supervisorRates: SupervisorRate[];
  undoToast: UndoState | null;

  calViewDate: Date;
  calSelDate: string | null;
  calEvents: CalEvent[];

  caregiverPhone: string; // E.164-ish, will be sanitized for wa.me
  vitals: VitalReading[];

  toggleTheme: () => void;
  cycleLang: () => void;
  setLang: (l: Lang) => void;
  setTimeFormat: (f: TimeFormat) => void;
  setLoginRole: (r: Role) => void;
  setLoginMode: (m: "login" | "signup") => void;
  doLogin: () => void;
  logout: () => void;
  confirmElder: (id: number) => void;
  missedElder: (id: number) => void;
  resolveAlert: (id: number) => void;
  showUndo: (msg: string, undo: () => void) => void;
  clearUndo: () => void;

  setCalViewDate: (d: Date) => void;
  setCalSelDate: (d: string | null) => void;
  addCalEvent: (e: Omit<CalEvent, "id">) => void;
  deleteCalEvent: (id: number) => void;

  addVital: (v: Omit<VitalReading, "id">) => void;
  deleteVital: (id: number) => void;
}

let undoTimer: ReturnType<typeof setTimeout> | null = null;

export const usePingStore = create<PingState>((set, get) => ({
  theme: readLS<"light" | "dark">(LS_THEME, ["light", "dark"], "light"),
  lang: readLS<Lang>(LS_LANG, ["en", "ms", "zh"], "en"),
  timeFormat: readLS<TimeFormat>(LS_TIMEFMT, ["12h", "24h"], "12h"),
  user: null,
  loginRole: "supervisor",
  loginMode: "login",
  elders: [],
  alerts: [],
  hist7: [],
  supervisorRates: [],
  undoToast: null,

  calViewDate: new Date(),
  calSelDate: null,
  calEvents: [],

  caregiverPhone: "+60 11-2345 6789",
  vitals: [],

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    writeLS(LS_THEME, next);
    set({ theme: next });
  },
  cycleLang: () => {
    const order: Lang[] = ["en", "ms", "zh"];
    const cur = get().lang;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    writeLS(LS_LANG, next);
    set({ lang: next });
  },
  setLang: (l) => { writeLS(LS_LANG, l); set({ lang: l }); },
  setTimeFormat: (f) => { writeLS(LS_TIMEFMT, f); set({ timeFormat: f }); },
  setLoginRole: (r) => set({ loginRole: r }),
  setLoginMode: (m) => set({ loginMode: m }),
  doLogin: () => {
    const role = get().loginRole;
    const name = role === "supervisor" ? "Sarah Tan" : "Grandma Rose";
    set({ user: { name, role } });
  },
  logout: () => set({ user: null }),
  confirmElder: (id) => {
    const elders = get().elders.map((e) => (e.id === id ? { ...e, status: "confirmed" as Status } : e));
    const prevElder = get().elders.find((e) => e.id === id);
    const prevAlerts = get().alerts;
    const alerts = prevAlerts.map((a) => (a.elderName === prevElder?.name ? { ...a, resolved: true } : a));
    set({ elders, alerts });
    get().showUndo(useT(get().lang, "undo_confirmed"), () =>
      set({ elders: get().elders.map((e) => (e.id === id ? { ...e, status: prevElder?.status ?? "pending" } : e)), alerts: prevAlerts }),
    );
  },
  missedElder: (id) => {
    const prev = get().elders.find((e) => e.id === id);
    const elders = get().elders.map((e) => (e.id === id ? { ...e, status: "missed" as Status } : e));
    set({ elders });
    get().showUndo(useT(get().lang, "undo_missed"), () =>
      set({ elders: get().elders.map((e) => (e.id === id ? { ...e, status: prev?.status ?? "pending" } : e)) }),
    );
  },
  resolveAlert: (id) =>
    set({ alerts: get().alerts.map((a) => (a.id === id ? { ...a, resolved: true } : a)) }),
  showUndo: (msg, undo) => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoToast: { msg, undo } });
    undoTimer = setTimeout(() => set({ undoToast: null }), 6000);
  },
  clearUndo: () => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoToast: null });
  },

  setCalViewDate: (d) => set({ calViewDate: d, calSelDate: null }),
  setCalSelDate: (d) => set({ calSelDate: d }),
  addCalEvent: (e) => set({ calEvents: [...get().calEvents, { ...e, id: Date.now() }] }),
  deleteCalEvent: (id) => set({ calEvents: get().calEvents.filter((e) => e.id !== id) }),

  addVital: (v) => set({ vitals: [{ ...v, id: Date.now() }, ...get().vitals] }),
  deleteVital: (id) => set({ vitals: get().vitals.filter((v) => v.id !== id) }),
}));

import { LANGS } from "@/lib/translations";
function useT(lang: Lang, key: string) {
  return LANGS[lang]?.[key] || LANGS.en[key] || key;
}

export function useT_hook() {
  const lang = usePingStore((s) => s.lang);
  return (key: string) => LANGS[lang]?.[key] || LANGS.en[key] || key;
}

export function initials(name: string) {
  return (name || "")
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function tzTime(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-MY", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz || "Asia/Kuala_Lumpur",
    }).format(new Date());
  } catch {
    return "—";
  }
}

/** Hook-version of tzTime that updates each minute. SSR-safe (returns "—" until hydrated). */
import { useEffect, useState } from "react";
export function useTzTime(tz: string) {
  const [t, setT] = useState<string>("—");
  useEffect(() => {
    const update = () => setT(tzTime(tz));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [tz]);
  return t;
}
