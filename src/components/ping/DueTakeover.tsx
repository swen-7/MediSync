import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { useT_hook, useTimeFormat, formatScheduledTime, formatClockShort } from "@/store/usePingStore";
import { PhotoCapture } from "./PhotoCapture";
import { showLocalNotification } from "@/lib/push";
import type { DueState } from "@/lib/dueLogic";

export interface DueMed {
  id: string;
  med_name: string;
  dosage: string;
  scheduled_time: string;
  remaining_qty: number;
  unit: string;
}

export function DueTakeover({
  med,
  state,
  dueAt,
  minutesDelta,
  onResolved,
}: {
  med: DueMed;
  state: DueState;
  dueAt: Date;
  minutesDelta: number;
  onResolved: () => void;
}) {
  const t = useT_hook();
  const timeFmt = useTimeFormat();
  const { profile } = useAuth();
  const [photo1, setPhoto1] = useState<Blob | null>(null);
  const [photo2, setPhoto2] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const tone =
    state === "overdue"
      ? { bg: "bg-red", border: "border-red", text: "text-white", label: "🚨 OVERDUE" }
      : state === "due"
      ? { bg: "bg-amber", border: "border-amber", text: "text-white", label: "⏰ DUE NOW" }
      : { bg: "bg-teal", border: "border-teal", text: "text-white", label: "🔔 APPROACHING" };

  const subtitle =
    state === "approaching"
      ? `In ${minutesDelta} min`
      : state === "due"
      ? `Now (${formatClockShort(dueAt, timeFmt)})`
      : `${Math.abs(minutesDelta)} min late`;

  const uploadPhoto = async (logId: string, slot: 1 | 2, blob: Blob): Promise<string | null> => {
    if (!profile?.id) return null;
    const path = `${profile.id}/${logId}_${slot}.jpg`;
    const { error } = await supabase.storage
      .from("med-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.error(error);
      return null;
    }
    return path;
  };

  const handleConfirm = async () => {
    if (!profile?.id) return;
    if (!photo1 || !photo2) {
      toast.error(t("photo_need_both"));
      return;
    }
    setBusy(true);
    try {
      // 1. insert log row first to get id
      const { data: log, error: insErr } = await supabase
        .from("medication_logs")
        .insert({
          patient_id: profile.id,
          medication_id: med.id,
          due_at: dueAt.toISOString(),
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insErr || !log) throw insErr ?? new Error("log insert failed");

      // 2. upload both photos and patch row with their paths
      const [p1, p2] = await Promise.all([
        uploadPhoto(log.id, 1, photo1),
        uploadPhoto(log.id, 2, photo2),
      ]);
      if (!p1 || !p2) {
        toast.error("Photo upload failed — log saved without photos.");
      } else {
        await supabase
          .from("medication_logs")
          .update({ photo1_url: p1, photo2_url: p2 })
          .eq("id", log.id);
      }

      // 3. decrement remaining_qty
      const newQty = Math.max(0, med.remaining_qty - 1);
      await supabase
        .from("medications")
        .update({ remaining_qty: newQty })
        .eq("id", med.id);

      // 4. fire push side-effects (low-stock + patient affirmation)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch("/api/push/on-confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              patientId: profile.id,
              medicationId: med.id,
              medName: med.med_name,
              patientName: profile.full_name,
              remainingQty: newQty,
            }),
          });
        }
      } catch {
        /* push failures are non-blocking */
      }
      showLocalNotification("✅ Great job!", "You've successfully logged your medication. Keep up the good work!");

      toast.success(t("confirmed_taken"));
      onResolved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (!profile?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("medication_logs").insert({
        patient_id: profile.id,
        medication_id: med.id,
        due_at: dueAt.toISOString(),
        status: "missed",
      });
      if (error) throw error;
      toast(t("undo_missed"));
      onResolved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-background/95 backdrop-blur-sm flex flex-col">
      <div className={`${tone.bg} ${tone.text} px-5 py-4 font-extrabold text-fs-base shadow-[var(--shadow-ping)] flex items-center justify-between gap-3`}>
        <span className="flex-1 text-center">{tone.label} · {subtitle}</span>
        <button
          type="button"
          onClick={onResolved}
          aria-label="Postpone"
          title="Postpone"
          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center text-xl leading-none shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 max-w-[480px] mx-auto w-full">
        <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-ping)] mb-4">
          <div className="font-display text-fs-2xl font-semibold mb-1">{med.med_name}</div>
          <div className="text-fs-sm text-muted-foreground">
            {med.dosage} · {formatScheduledTime(med.scheduled_time, timeFmt)}
          </div>
          <div className="text-fs-xs text-muted-foreground mt-2">
            Remaining: {med.remaining_qty} {med.unit}
          </div>
        </div>

        <div className="font-extrabold text-fs-sm mb-2">{t("photo_two_step_title")}</div>
        <div className="space-y-3">
          <PhotoCapture slot={1} prompt={t("photo_prompt_1")} onCaptured={(b) => setPhoto1(b)} />
          <PhotoCapture slot={2} prompt={t("photo_prompt_2")} onCaptured={(b) => setPhoto2(b)} />
        </div>
        <div className="text-fs-xs text-muted-foreground text-center mt-2">
          {t("photo_required_note")}
        </div>
      </div>

      <div className="p-4 border-t border-border bg-card flex gap-2 max-w-[480px] mx-auto w-full">
        <button
          onClick={handleSkip}
          disabled={busy}
          className="flex-1 bg-input-bg text-foreground border border-border font-bold py-3.5 rounded-xl disabled:opacity-50"
        >
          ✗ Skip
        </button>
        <button
          onClick={handleConfirm}
          disabled={busy || !photo1 || !photo2}
          className="flex-[2] bg-green text-white font-extrabold py-3.5 rounded-xl disabled:opacity-50 shadow-[var(--shadow-ping)]"
        >
          {busy ? "Saving…" : "✓ I took it"}
        </button>
      </div>
    </div>
  );
}
