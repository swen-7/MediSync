import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";

export type AppRole = "caregiver" | "patient";

export interface AuthProfile {
  id: string;
  full_name: string;
  phone: string | null;
  language_pref: "en" | "ms" | "zh";
  invite_code: string | null;
  role: AppRole | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    // Run in parallel: profile + role
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    if (p) {
      setProfile({
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        language_pref: p.language_pref,
        invite_code: p.invite_code,
        role: (r?.role as AppRole) ?? null,
      });
    } else {
      setProfile(null);
    }
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    // CRITICAL: subscribe FIRST, then getSession
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
