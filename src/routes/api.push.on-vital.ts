import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildVapidAuthHeader, encryptPushPayload } from "@/lib/webPushSign";
import { createClient } from "@supabase/supabase-js";

/**
 * Called when a patient records a new vital. Sends an alert to all linked
 * supervisors so they're notified of fresh BP / glucose readings.
 */

const Body = z.object({
  patientId: z.string().uuid(),
  patientName: z.string().min(1).max(200),
  systolic: z.number().int().nullable().optional(),
  diastolic: z.number().int().nullable().optional(),
  pulse: z.number().int().nullable().optional(),
  glucose: z.number().nullable().optional(),
});

interface SubRow { user_id: string; endpoint: string; p256dh: string; auth: string }

async function sendOne(sub: SubRow, payload: string, vapid: { pub: string; priv: string; sub: string }) {
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
    console.error("push send failed", sub.endpoint, e);
  }
}

export const Route = createFileRoute("/api/push/on-vital")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
        const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
        const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@ping.app";
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
          return Response.json({ ok: false, error: "vapid not configured" }, { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
          return Response.json({ ok: false, error: "missing bearer token" }, { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) {
          return Response.json({ ok: false, error: "invalid token" }, { status: 403 });
        }
        const callerId = userData.user.id;

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
        }

        if (callerId !== parsed.patientId) {
          return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
        }

        const vapid = { pub: VAPID_PUBLIC_KEY, priv: VAPID_PRIVATE_KEY, sub: VAPID_SUBJECT };

        const { data: links } = await supabaseAdmin
          .from("patients_supervisors")
          .select("supervisor_id")
          .eq("patient_id", parsed.patientId);
        const supervisorIds = (links ?? []).map((l) => l.supervisor_id);
        if (supervisorIds.length === 0) return Response.json({ ok: true });

        const { data: cgSubs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth")
          .in("user_id", supervisorIds);
        const subs = (cgSubs ?? []) as SubRow[];

        const parts: string[] = [];
        if (parsed.systolic != null && parsed.diastolic != null) {
          parts.push(`BP ${parsed.systolic}/${parsed.diastolic}`);
        }
        if (parsed.glucose != null) parts.push(`Glucose ${parsed.glucose} mmol/L`);
        if (parsed.pulse != null) parts.push(`Pulse ${parsed.pulse}`);
        const summary = parts.join(" · ") || "New reading";

        const payload = JSON.stringify({
          title: "❤️ New Vitals Recorded",
          body: `${parsed.patientName}: ${summary}`,
          tag: `vital-${parsed.patientId}-${Date.now()}`,
          url: "/history",
        });
        await Promise.all(subs.map((s) => sendOne(s, payload, vapid)));

        return Response.json({ ok: true });
      },
    },
  },
});