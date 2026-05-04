import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently delete the authenticated user's account, related data,
 * and Supabase auth record. RLS-bound rows cascade through patient/supervisor
 * tables; we additionally clean up rows that reference the user as supervisor.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Best-effort data cleanup. Errors here are non-fatal — the auth user
    // delete is the source of truth.
    await Promise.all([
      supabaseAdmin.from("medication_logs").delete().eq("patient_id", userId),
      supabaseAdmin.from("medications").delete().eq("patient_id", userId),
      supabaseAdmin.from("calendar_events").delete().eq("patient_id", userId),
      supabaseAdmin.from("vitals").delete().eq("patient_id", userId),
      supabaseAdmin.from("patient_settings").delete().eq("patient_id", userId),
      supabaseAdmin.from("push_subscriptions").delete().eq("user_id", userId),
      supabaseAdmin.from("patients_supervisors").delete().eq("patient_id", userId),
      supabaseAdmin.from("patients_supervisors").delete().eq("supervisor_id", userId),
      supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
      supabaseAdmin.from("profiles").delete().eq("id", userId),
    ]);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });