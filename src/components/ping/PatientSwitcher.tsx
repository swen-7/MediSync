import { usePatients } from "@/lib/patientContext";
import { Link } from "@tanstack/react-router";

/**
 * Caregiver-only header chip: shows currently selected linked patient,
 * lets caregiver switch between them. If none linked, prompts to /link.
 */
export function PatientSwitcher() {
  const { patients, selected, setSelectedId, loading } = usePatients();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl px-4 py-3 mb-3.5 text-fs-sm text-muted-foreground">
        Loading patients…
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <Link
        to="/link"
        className="block bg-amber-l border border-amber rounded-2xl px-4 py-3 mb-3.5"
      >
        <div className="text-fs-xs font-extrabold text-amber uppercase tracking-wider">
          No patient linked
        </div>
        <div className="text-fs-sm font-bold text-amber mt-0.5">
          Tap to enter an invite code →
        </div>
      </Link>
    );
  }

  if (patients.length === 1) {
    return (
      <div className="bg-green-l border border-green-m rounded-2xl px-4 py-2.5 mb-3.5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green text-white flex items-center justify-center font-extrabold text-fs-xs shrink-0">
          {selected?.full_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.65rem] uppercase tracking-wider text-green font-extrabold">
            Viewing
          </div>
          <div className="font-bold text-fs-sm text-foreground truncate">
            {selected?.full_name}
          </div>
        </div>
        <Link to="/link" className="text-green text-fs-xs font-bold underline">
          + Add
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 mb-3.5 flex items-center gap-2 shadow-[var(--shadow-ping)]">
      <div className="text-[0.65rem] uppercase tracking-wider text-hint font-extrabold shrink-0">
        Patient
      </div>
      <select
        value={selected?.id ?? ""}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 bg-input-bg border border-border rounded-xl px-3 py-2 font-bold text-fs-sm focus:outline-none focus:border-green"
      >
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </select>
      <Link to="/link" className="text-green text-fs-xs font-bold px-2">
        + Add
      </Link>
    </div>
  );
}