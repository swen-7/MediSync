import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";

/**
 * Live unread-alerts count for the current supervisor.
 * Counts pending/missed medication_logs (not resolved) for ALL linked patients
 * within the last 7 days. Refreshes on a 30s interval and on realtime changes.
 */
export function useAlertsCount(): number {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile?.id || profile.role !== "supervisor") {
      setCount(0);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data: links } = await supabase
        .from("patients_supervisors")
        .select("patient_id")
        .eq("supervisor_id", profile.id);
      const ids = (links ?? []).map((l) => l.patient_id);
      if (ids.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { count: c } = await supabase
        .from("medication_logs")
        .select("id", { count: "exact", head: true })
        .in("patient_id", ids)
        .in("status", ["pending", "missed"])
        .is("resolved_at", null)
        .gte("due_at", since);
      if (!cancelled) setCount(c ?? 0);
    };

    load();
    const interval = setInterval(load, 30_000);

    const channel = supabase
      .channel(`alerts-count-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medication_logs" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role]);

  return count;
}