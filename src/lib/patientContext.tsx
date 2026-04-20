import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-provider";

/**
 * Caregiver-side: which linked patient is the caregiver currently viewing?
 * Patient-side: this provider isn't used — patients always operate on auth.uid().
 *
 * Linked patients are read via the `patients_caregivers` join table; we then
 * fetch matching profile rows in a single query (RLS allows caregivers to
 * see linked patient profiles via `is_linked_caregiver`).
 */
export interface LinkedPatient {
  id: string;
  full_name: string;
  phone: string | null;
  invite_code: string | null;
}

interface Ctx {
  patients: LinkedPatient[];
  loading: boolean;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  selected: LinkedPatient | null;
  refresh: () => Promise<void>;
}

const PatientCtx = createContext<Ctx>({
  patients: [],
  loading: true,
  selectedId: null,
  setSelectedId: () => {},
  selected: null,
  refresh: async () => {},
});

const STORAGE_KEY = "ping.selectedPatientId";

export function PatientProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  const load = async () => {
    if (!profile || profile.role !== "caregiver") {
      setPatients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: links } = await supabase
      .from("patients_caregivers")
      .select("patient_id")
      .eq("caregiver_id", profile.id);
    const ids = (links ?? []).map((l) => l.patient_id);
    if (ids.length === 0) {
      setPatients([]);
      setSelectedIdState(null);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, phone, invite_code")
      .in("id", ids);
    const list = (profs ?? []) as LinkedPatient[];
    setPatients(list);
    // restore selection from localStorage if still valid; else first
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const next = saved && list.some((p) => p.id === saved) ? saved : list[0]?.id ?? null;
    setSelectedIdState(next);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  const setSelectedId = (id: string) => {
    setSelectedIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  return (
    <PatientCtx.Provider value={{ patients, loading, selectedId, setSelectedId, selected, refresh: load }}>
      {children}
    </PatientCtx.Provider>
  );
}

export const usePatients = () => useContext(PatientCtx);