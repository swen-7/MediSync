/**
 * Compute & persist the patient's medication adherence streak.
 *
 * Rule: A streak day counts if ALL active medications scheduled for THAT day
 *       were logged as "confirmed" (or there were no scheduled meds for the day).
 *
 * - If today is fully confirmed and last_streak_date is yesterday → increment.
 * - If today is fully confirmed and last_streak_date is today → no change.
 * - If a missed log exists today → reset to 0.
 * - If last_streak_date is older than yesterday and not all confirmed yet → keep value, do not break until day ends.
 */
import { supabase } from "@/integrations/supabase/client";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function evaluateStreak(patientId: string): Promise<{
  current_streak: number;
  fully_done_today: boolean;
}> {
  const today = new Date();
  const todayKey = ymd(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = ymd(yesterday);

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: meds }, { data: logs }, { data: prof }] = await Promise.all([
    supabase
      .from("medications")
      .select("id")
      .eq("patient_id", patientId)
      .eq("active", true),
    supabase
      .from("medication_logs")
      .select("medication_id, status")
      .eq("patient_id", patientId)
      .gte("due_at", startOfDay.toISOString()),
    supabase
      .from("profiles")
      .select("current_streak, last_streak_date")
      .eq("id", patientId)
      .maybeSingle(),
  ]);

  const totalMeds = meds?.length ?? 0;
  const confirmed = (logs ?? []).filter((l) => l.status === "confirmed").length;
  const missed = (logs ?? []).filter((l) => l.status === "missed").length;
  const fullyDoneToday = totalMeds > 0 && confirmed >= totalMeds && missed === 0;

  let streak = prof?.current_streak ?? 0;
  const last = prof?.last_streak_date ?? null;

  if (missed > 0) {
    // Any miss resets the streak immediately.
    if (streak !== 0 || last !== todayKey) {
      streak = 0;
      await supabase
        .from("profiles")
        .update({ current_streak: 0, last_streak_date: todayKey })
        .eq("id", patientId);
    }
  } else if (fullyDoneToday && last !== todayKey) {
    streak = last === yKey ? streak + 1 : 1;
    await supabase
      .from("profiles")
      .update({ current_streak: streak, last_streak_date: todayKey })
      .eq("id", patientId);
  }

  return { current_streak: streak, fully_done_today: fullyDoneToday };
}
