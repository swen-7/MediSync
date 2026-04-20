import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Ping" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell title="Calendar">
      <div className="flex-1 px-4 pt-4 pb-24">
        <div className="font-display text-fs-xl font-semibold mb-1">Calendar</div>
        <div className="text-fs-sm text-muted-foreground mb-6">Coming in the next phase.</div>
        <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center text-muted-foreground text-fs-sm">
          This screen will be built in the next phase of the conversion.
        </div>
      </div>
    </AppShell>
  );
}
