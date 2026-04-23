import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildVapidAuthHeader, encryptPushPayload } from "@/lib/webPushSign";
import { createClient } from "@supabase/supabase-js";

/**
 * Called when a patient confirms a medication. Side-effects:
 *  1. Patient affirmation push ("Great job…")
 *  2. If remainingQty === 7, send linked caregivers a low-stock alert.
 *
 * Authentication note: this endpoint trusts patientId from the body but only
 * uses it to look up subscriptions and linked caregivers — no privileged
 * mutations are performed. Push payloads carry no sensitive data.
 */

const Body = z.object({
  patientId: z.string().uuid(),
  medicationId: z.string().uuid(),
  medName: z.string().min(1).max(200),
  patientName: z.string().min(1).max(200),
  remainingQty: z.number().int().min(0).max(100000),
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
      // Subscription gone — clean it up.
      await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  } catch (e) {
    console.error("push send failed", sub.endpoint, e);
  }
}

export const Route = createFileRoute("/api/push/on-confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
        const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
        const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@ping.app";
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
          return Response.json({ ok: false, error: "vapid not configured" }, { status: 500 });
        }

        // ---- AUTH GUARD ---------------------------------------------------
        const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
        if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
          return Response.json({ ok: false, error: "missing bearer token" }, { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        if (!token) {
          return Response.json({ ok: false, error: "missing token" }, { status: 401 });
        }
        const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return Response.json({ ok: false, error: "auth not configured" }, { status: 500 });
        }
        const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) {
          return Response.json({ ok: false, error: "invalid token" }, { status: 403 });
        }
        const callerId = userData.user.id;
        // ------------------------------------------------------------------

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch (e) {
          return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
        }

        // Authorize: caller must be the patient themselves OR a linked caregiver.
        if (callerId !== parsed.patientId) {
          const { data: link } = await supabaseAdmin
            .from("patients_caregivers")
            .select("id")
            .eq("patient_id", parsed.patientId)
            .eq("caregiver_id", callerId)
            .maybeSingle();
          if (!link) {
            return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
          }
        }

        const vapid = { pub: VAPID_PUBLIC_KEY, priv: VAPID_PRIVATE_KEY, sub: VAPID_SUBJECT };

        // 1) Affirmation to patient
        const { data: patientSubs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth")
          .eq("user_id", parsed.patientId);
        const affirm = JSON.stringify({
          title: "✅ Great job!",
          body: "You've successfully logged your medication. Keep up the good work!",
          tag: `affirm-${parsed.medicationId}`,
          url: "/my-meds",
        });
        await Promise.all((patientSubs ?? []).map((s) => sendOne(s as SubRow, affirm, vapid)));

        // 2) Low-stock alert to caregivers when qty === 7
        if (parsed.remainingQty === 7) {
          const { data: links } = await supabaseAdmin
            .from("patients_caregivers")
            .select("caregiver_id")
            .eq("patient_id", parsed.patientId);
          const caregiverIds = (links ?? []).map((l) => l.caregiver_id);
          if (caregiverIds.length > 0) {
            const { data: cgSubs } = await supabaseAdmin
              .from("push_subscriptions")
              .select("user_id, endpoint, p256dh, auth")
              .in("user_id", caregiverIds);
            const lowStock = JSON.stringify({
              title: "⚠️ Low Stock Alert",
              body: `${parsed.patientName} only has 7 doses of ${parsed.medName} remaining. Please arrange a refill.`,
              tag: `lowstock-${parsed.medicationId}`,
              url: "/dashboard",
            });
            await Promise.all((cgSubs ?? []).map((s) => sendOne(s as SubRow, lowStock, vapid)));
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});