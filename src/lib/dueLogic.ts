/**
 * Pure helpers for medication due-window calculation.
 * scheduledTime is "HH:MM:SS" in local (Asia/KL) time — we treat it as today's wall clock.
 */

export type DueState = "idle" | "approaching" | "due" | "overdue";

export const APPROACH_MIN = 10; // minutes before
export const DUE_WINDOW_MIN = 15; // minutes after which it becomes overdue

export interface DueInfo {
  state: DueState;
  dueAt: Date;
  /** minutes from now until dueAt (positive = future, negative = past) */
  minutesDelta: number;
}

export function parseScheduled(time: string, base: Date = new Date()): Date {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function computeWindow(now: Date, scheduledTime: string): DueInfo {
  const dueAt = parseScheduled(scheduledTime, now);
  const minutesDelta = Math.round((dueAt.getTime() - now.getTime()) / 60000);
  let state: DueState;
  if (minutesDelta > APPROACH_MIN) state = "idle";
  else if (minutesDelta > 0) state = "approaching";
  else if (-minutesDelta <= DUE_WINDOW_MIN) state = "due";
  else state = "overdue";
  return { state, dueAt, minutesDelta };
}

export function todayDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
