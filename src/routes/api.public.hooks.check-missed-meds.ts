import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildVapidAuthHeader, encryptPushPayload } from "@/lib/webPushSign";

/**
 * Cron endpoint — scans for medications whose scheduled dose is >15 minutes
 * past due without a confirmed log, and pushes a "Missed Medication" alert
 * to all linked supervisors. Idempotent via `missed_alert_sent_at` flag.
 *
 * Called by pg_cron every 5 minutes. Public route — no auth required, but
 * also performs no caller-trusted writes; only reads scheduled meds and
 * sends pushes for already-overdue logs.
 */

interface SubRow { user_id: string; endpoint: string; p256dh: string; auth: string }

async function sendOne(
  sub: SubRow,
  payload: string,
  vapid: { pub: string; priv: string; sub: string },
) {
  try {
    const body = await encryptPushPayload({ payload, p256dh: sub.p256dh, auth: sub.auth });
    const auth = await buildVapidAuthHeader({
      endpoint: sub.endpoint,
      subject: vapid.sub,
      publicKey: vapid.pub,
      privateKey: vapid.priv,
    });
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "3600",
        Urgency: "high",
        Authorization: auth.authorization,
      },
      body: body as BodyInit,
    });
    if (res.status === 404 || res.status === 410) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  } catch (e) {
    console.error("missed-meds push failed", sub.endpoint, e);
  }
}

export const Route = createFileRoute("/api/public/hooks/check-missed-meds")({
  server: {
    handlers: {
      POST: async () => {
        const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
        const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
        const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@ping.app";
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
          return Response.json({ ok: false, error: "vapid not configured" }, { status: 500 });
        }
        const vapid = { pub: VAPID_PUBLIC_KEY, priv: VAPID_PRIVATE_KEY, sub: VAPID_SUBJECT };

        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const windowStart = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

        // Find pending logs > 15 min overdue that haven't been alerted yet
        const { data: overdue, error } = await supabaseAdmin
          .from("medication_logs")
          .select("id, patient_id, medication_id, due_at")
          .eq("status", "pending")
          .is("missed_alert_sent_at", null)
          .lte("due_at", cutoff)
          .gte("due_at", windowStart);

        if (error) {
          console.error("check-missed-meds query failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        if (!overdue || overdue.length === 0) {
          return Response.json({ ok: true, processed: 0 });
        }

        // Batch-load med + patient names
        const medIds = [...new Set(overdue.map((o) => o.medication_id))];
        const patientIds = [...new Set(overdue.map((o) => o.patient_id))];
        const [{ data: meds }, { data: patients }, { data: links }] = await Promise.all([
          supabaseAdmin.from("medications").select("id, med_name").in("id", medIds),
          supabaseAdmin.from("profiles").select("id, full_name").in("id", patientIds),
          supabaseAdmin
            .from("patients_supervisors")
            .select("patient_id, supervisor_id")
            .in("patient_id", patientIds),
        ]);

        const medMap = new Map((meds ?? []).map((m) => [m.id, m.med_name]));
        const patientMap = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
        const supByPatient = new Map<string, string[]>();
        (links ?? []).forEach((l) => {
          const arr = supByPatient.get(l.patient_id) ?? [];
          arr.push(l.supervisor_id);
          supByPatient.set(l.patient_id, arr);
        });

        const allSupervisorIds = [...new Set((links ?? []).map((l) => l.supervisor_id))];
        const { data: allSubs } = allSupervisorIds.length
          ? await supabaseAdmin
              .from("push_subscriptions")
              .select("user_id, endpoint, p256dh, auth")
              .in("user_id", allSupervisorIds)
          : { data: [] as SubRow[] };

        const subsByUser = new Map<string, SubRow[]>();
        ((allSubs ?? []) as SubRow[]).forEach((s) => {
          const arr = subsByUser.get(s.user_id) ?? [];
          arr.push(s);
          subsByUser.set(s.user_id, arr);
        });

        let sent = 0;
        const alertedLogIds: string[] = [];

        for (const log of overdue) {
          const medName = medMap.get(log.medication_id) ?? "their medication";
          const patientName = patientMap.get(log.patient_id) ?? "Patient";
          const supervisors = supByPatient.get(log.patient_id) ?? [];
          if (supervisors.length === 0) {
            alertedLogIds.push(log.id);
            continue;
          }

          const payload = JSON.stringify({
            title: "🚨 Missed Medication",
            body: `${patientName} hasn't confirmed ${medName} (due ${new Date(log.due_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}).`,
            tag: `missed-${log.id}`,
            url: "/dashboard",
            requireInteraction: true,
          });

          for (const supId of supervisors) {
            const subs = subsByUser.get(supId) ?? [];
            await Promise.all(subs.map((s) => sendOne(s, payload, vapid)));
            sent += subs.length;
          }
          alertedLogIds.push(log.id);
        }

        if (alertedLogIds.length > 0) {
          await supabaseAdmin
            .from("medication_logs")
            .update({ missed_alert_sent_at: new Date().toISOString() })
            .in("id", alertedLogIds);
        }

        return Response.json({ ok: true, processed: overdue.length, pushes: sent });
      },
    },
  },
});