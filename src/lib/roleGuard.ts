/**
 * Client-side role guard hook.
 * Prevents users from accessing routes outside their role's permitted pages.
 *
 * Patient routes: /my-meds, /clinics, /link, /settings, /alerts (own logs)
 * Supervisor routes: /dashboard, /medications, /alerts, /clinics, /link, /settings, /calendar
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/integrations/supabase/auth-provider";

const PATIENT_ALLOWED = new Set([
  "/my-meds",
  "/calendar",
  "/clinics",
  "/settings",
]);

const SUPERVISOR_ALLOWED = new Set([
  "/dashboard",
  "/medications",
  "/alerts",
  "/clinics",
  "/settings",
  "/calendar",
  "/history",
]);

export function useRoleGuard(currentPath: string) {
  const { profile, session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    if (!profile?.role) return;

    if (profile.role === "patient" && !PATIENT_ALLOWED.has(currentPath)) {
      navigate({ to: "/my-meds" });
    } else if (profile.role === "supervisor" && !SUPERVISOR_ALLOWED.has(currentPath)) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, session, profile?.role, currentPath, navigate]);
}
