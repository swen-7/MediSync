import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useMemo, useState } from "react";
import { MY_CLINICS, MY_STATES, wazeUrl, gmapsUrl, telUrl, type Clinic } from "@/lib/clinics";

export const Route = createFileRoute("/clinics")({
  head: () => ({
    meta: [
      { title: "Clinics — Ping" },
    ],
  }),
  component: Page,
});

function Page() {
  const [state, setState] = useState<string>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MY_CLINICS.filter((c) => {
      if (state !== "All" && c.state !== state) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.area.toLowerCase().includes(needle) ||
        c.address.toLowerCase().includes(needle)
      );
    });
  }, [state, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Clinic[]>();
    for (const c of filtered) {
      if (!map.has(c.state)) map.set(c.state, []);
      map.get(c.state)!.push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <AppShell title="Clinics">
      <div className="flex-1 px-4 pt-4 pb-24">
        <div className="font-display text-fs-xl font-semibold mb-1">Nearby clinics & hospitals</div>
        <div className="text-fs-xs text-muted-foreground mb-3">Tap Waze or Maps to navigate. Tap the phone to call.</div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, area, address…"
          className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-sm mb-2"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {(["All", ...MY_STATES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-fs-xs font-bold border transition-colors ${
                state === s ? "bg-green text-white border-green" : "bg-card border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {grouped.length === 0 && (
          <div className="bg-card rounded-2xl p-6 border border-border text-center text-muted-foreground text-fs-sm">
            No clinics match your search.
          </div>
        )}

        {grouped.map(([st, list]) => (
          <div key={st} className="mb-5">
            <div className="text-fs-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">{st}</div>
            {list.map((c) => (
              <ClinicCard key={c.id} c={c} />
            ))}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function ClinicCard({ c }: { c: Clinic }) {
  const tel = telUrl(c.phone);
  const typeBadge =
    c.type === "hospital" ? "bg-teal-l text-teal" : c.type === "klinik_kesihatan" ? "bg-green-l text-green" : "bg-amber-l text-amber";
  const typeLabel = c.type === "klinik_kesihatan" ? "KK" : c.type === "hospital" ? "Hospital" : "Clinic";
  return (
    <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-extrabold text-fs-sm leading-tight">{c.name}</div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${typeBadge}`}>{typeLabel}</span>
      </div>
      <div className="text-fs-xs text-muted-foreground mb-2.5">{c.address}</div>
      <div className="grid grid-cols-3 gap-1.5">
        <a
          href={wazeUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center bg-[#33ccff] text-white font-bold text-fs-xs py-2 rounded-xl"
        >
          🚗 Waze
        </a>
        <a
          href={gmapsUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center bg-green text-white font-bold text-fs-xs py-2 rounded-xl"
        >
          🗺️ Maps
        </a>
        {tel ? (
          <a href={tel} className="text-center bg-foreground text-background font-bold text-fs-xs py-2 rounded-xl">
            📞 Call
          </a>
        ) : (
          <span className="text-center bg-input-bg text-muted-foreground font-bold text-fs-xs py-2 rounded-xl opacity-60">
            No phone
          </span>
        )}
      </div>
    </div>
  );
}
