import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Documented patient route alias. The actual patient dashboard lives at
 * /my-meds — keeping the URL surface stable instead of renaming files.
 */
export const Route = createFileRoute("/patient-dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/my-meds" });
  },
});