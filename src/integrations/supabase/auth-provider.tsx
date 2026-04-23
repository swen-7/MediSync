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

const PENDING_ROLE_KEY = "pendingRegistrationRole";
const JUST_REGISTERED_KEY = "justRegistered";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    // 1. Try to read existing profile + role.
    let [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    // 2. Self-heal: if profile or role is missing (e.g. Google sign-in
    //    without trigger, or backfill needed), call ensure_my_profile.
    //    Pass any pending role captured before an OAuth redirect.
    if (!p || !r) {
      const pending =
        typeof window !== "undefined" ? window.localStorage.getItem(PENDING_ROLE_KEY) : null;
      const pendingRole: AppRole | null =
        pending === "caregiver" || pending === "patient" ? pending : null;

      try {
        await supabase.rpc("ensure_my_profile", {
          _role: pendingRole ?? undefined,
        } as { _role?: AppRole });
      } catch (e) {
        console.warn("ensure_my_profile failed", e);
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PENDING_ROLE_KEY);
      }

      // Re-read after the heal.
      const reread = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);
      p = reread[0].data;
      r = reread[1].data;
    }

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
        // Defer to avoid Supabase listener deadlock.
        setTimeout(async () => {
          // If this session is the result of a fresh OAuth/email signup,
          // make sure the profile/role exist, then sign the user out and
          // route them back to /login per the spec.
          const justRegistered =
            typeof window !== "undefined" &&
            window.localStorage.getItem(JUST_REGISTERED_KEY) === "1";

          await loadProfile(s.user.id);

          if (justRegistered) {
            window.localStorage.removeItem(JUST_REGISTERED_KEY);
            try {
              const { toast } = await import("sonner");
              toast.success("Registration successful! Please sign in to continue.");
            } catch {
              /* ignore */
            }
            await supabase.auth.signOut();
            if (typeof window !== "undefined") {
              window.location.replace("/login");
            }
          }
        }, 0);
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
