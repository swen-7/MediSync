import { create } from "zustand";
import type { Lang } from "@/lib/translations";

export type Role = "supervisor" | "elderly";
export type Status = "confirmed" | "missed" | "pending";

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
  theme: "light",
  lang: "en",
  user: null,
  loginRole: "supervisor",
  loginMode: "login",
  elders: [
    {
      id: 1, name: "Grandma Rose", age: 74, phone: "011-2345678", email: "rose@email.com",
      timezone: "Asia/Kuala_Lumpur", status: "confirmed", pdpaConsent: true,
      medications: [
        { id: 1, name: "Amlodipine 5mg", dosage: "5mg", freq: "Once daily", time: "08:00",
          customDays: [], totalQty: 30, remainingQty: 8, refillAlertDays: 7, pillImg: null, unit: "pills" },
        { id: 2, name: "Metformin 500mg", dosage: "500mg", freq: "Twice daily", time: "08:00",
          customDays: [], totalQty: 60, remainingQty: 52, refillAlertDays: 7, pillImg: null, unit: "pills" },
      ],
    },
    {
      id: 2, name: "Uncle David", age: 68, phone: "011-9876543", email: "david@email.com",
      timezone: "Asia/Kuala_Lumpur", status: "pending", pdpaConsent: true,
      medications: [
        { id: 3, name: "Atenolol 50mg", dosage: "50mg", freq: "Once daily", time: "09:00",
          customDays: [], totalQty: 30, remainingQty: 28, refillAlertDays: 7, pillImg: null, unit: "pills" },
      ],
    },
  ],
  alerts: [
    { id: 1, elderName: "Uncle David", elderMed: "Atenolol 50mg",
      time: "09:00 AM", ago: "1h 24m", resolved: false },
  ],
  hist7: ["confirmed", "confirmed", "missed", "confirmed", "confirmed", "pending", "pending"],
  supervisorRates: [
    { name: "Sarah Tan", rate: 88 },
    { name: "Michael Tan", rate: 62 },
    { name: "Priya Singh", rate: 41 },
    { name: "James Lim", rate: 79 },
  ],
  undoToast: null,

  calViewDate: new Date(),
  calSelDate: null,
  calEvents: [
    { id: 1, date: "2026-04-22", title: "Grandma Rose — Cardiologist", type: "doc", elder: "Grandma Rose", color: "#1890a0" },
    { id: 2, date: "2026-04-28", title: "Amlodipine 5mg expires", type: "medexp", elder: "Grandma Rose", color: "#e05555" },
    { id: 3, date: "2026-05-05", title: "Uncle David — Cardiology follow-up", type: "doc", elder: "Uncle David", color: "#1890a0" },
    { id: 4, date: "2026-04-26", title: "Amlodipine 5mg — Refill reminder", type: "med_schedule", elder: "Grandma Rose", color: "#2a9d6e" },
  ],

  caregiverPhone: "+60 11-2345 6789",
  vitals: [
    { id: 1, systolic: 128, diastolic: 82, pulse: 72, takenAt: "2026-04-19T08:15:00", note: "Before breakfast" },
    { id: 2, systolic: 134, diastolic: 86, pulse: 76, takenAt: "2026-04-18T08:05:00" },
    { id: 3, systolic: 122, diastolic: 78, pulse: 70, takenAt: "2026-04-17T08:20:00" },
  ],

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    set({ theme: next });
  },
  cycleLang: () => {
    const order: Lang[] = ["en", "ms", "zh"];
    const cur = get().lang;
    set({ lang: order[(order.indexOf(cur) + 1) % order.length] });
  },
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
