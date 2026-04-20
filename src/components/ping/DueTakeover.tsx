import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { useT_hook } from "@/store/usePingStore";
import { VideoRecorder } from "./VideoRecorder";
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
  const { profile } = useAuth();
  const [blob, setBlob] = useState<Blob | null>(null);
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
      ? `Now (${dueAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
      : `${Math.abs(minutesDelta)} min late`;

  const upload = async (logId: string): Promise<string | null> => {
    if (!blob || !profile?.id) return null;
    const path = `${profile.id}/${logId}.webm`;
    const { error } = await supabase.storage
      .from("med-videos")
      .upload(path, blob, { contentType: blob.type || "video/webm", upsert: true });
    if (error) {
      console.error(error);
      toast.error("Video upload failed (saved without video).");
      return null;
    }
    return path;
  };

  const handleConfirm = async () => {
    if (!profile?.id) return;
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

      // 2. upload video and patch row
      const path = await upload(log.id);
      if (path) {
        await supabase.from("medication_logs").update({ video_url: path }).eq("id", log.id);
      }

      // 3. decrement remaining_qty
      await supabase
        .from("medications")
        .update({ remaining_qty: Math.max(0, med.remaining_qty - 1) })
        .eq("id", med.id);

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
      <div className={`${tone.bg} ${tone.text} px-5 py-4 text-center font-extrabold text-fs-base shadow-[var(--shadow-ping)]`}>
        {tone.label} · {subtitle}
      </div>

      <div className="flex-1 overflow-y-auto p-5 max-w-[480px] mx-auto w-full">
        <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-ping)] mb-4">
          <div className="font-display text-fs-2xl font-semibold mb-1">{med.med_name}</div>
          <div className="text-fs-sm text-muted-foreground">
            {med.dosage} · {med.scheduled_time.slice(0, 5)}
          </div>
          <div className="text-fs-xs text-muted-foreground mt-2">
            Remaining: {med.remaining_qty} {med.unit}
          </div>
        </div>

        <div className="font-extrabold text-fs-sm mb-2">📹 Record yourself taking it</div>
        <VideoRecorder onBlob={setBlob} />
        <div className="text-fs-xs text-muted-foreground text-center mt-2">
          Optional — your caregiver will see this video.
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
          disabled={busy}
          className="flex-[2] bg-green text-white font-extrabold py-3.5 rounded-xl disabled:opacity-50 shadow-[var(--shadow-ping)]"
        >
          {busy ? "Saving…" : "✓ I took it"}
        </button>
      </div>
    </div>
  );
}
