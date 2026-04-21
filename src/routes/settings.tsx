import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ping" },
      { name: "description", content: "Manage your profile, notifications, and caregiver contact." },
    ],
  }),
  component: SettingsPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

function SettingsPage() {
  const { profile, session, loading, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (!profile) {
    return (
      <AppShell title="Settings">
        <div className="flex-1 px-4 pt-4 pb-24 text-center text-muted-foreground text-fs-sm">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="flex-1 px-4 pt-4 pb-24 space-y-5">
        <ProfileCard onSaved={refresh} />
        <PasswordCard />
        {profile.role === "patient" && <PatientPrefsCard patientId={profile.id} />}
      </div>
    </AppShell>
  );
}

function ProfileCard({ onSaved }: { onSaved: () => Promise<void> }) {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = profileSchema.safeParse({ full_name: fullName, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
      .eq("id", profile!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    await onSaved();
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">Profile</div>
      <Field label="Full name">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inp} />
      </Field>
      <Field label="Phone">
        <input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="+60 11-2345 6789" />
      </Field>
      <Field label="Email">
        <input value={profile?.id ? "" : ""} disabled className={`${inp} opacity-60`} placeholder="(set at signup)" />
      </Field>
      <button
        onClick={save}
        disabled={busy}
        className="w-full bg-green text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
    </section>
  );
}

function PasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw(""); setPw2("");
    toast.success("Password updated");
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">Change password</div>
      <Field label="New password">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inp} />
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inp} />
      </Field>
      <button
        onClick={save}
        disabled={busy || !pw}
        className="w-full bg-foreground text-background font-bold py-3 rounded-xl mt-2 disabled:opacity-50"
      >
        {busy ? "Updating…" : "Update password"}
      </button>
    </section>
  );
}

function PatientPrefsCard({ patientId }: { patientId: string }) {
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [push, setPush] = useState(true);
  const [aff, setAff] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("patient_settings")
        .select("caregiver_phone, push_notifications_enabled, affirmation_notifications_enabled")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (data) {
        setCaregiverPhone(data.caregiver_phone ?? "");
        setPush(data.push_notifications_enabled);
        setAff(data.affirmation_notifications_enabled);
      }
    })();
  }, [patientId]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("patient_settings")
      .upsert({
        patient_id: patientId,
        caregiver_phone: caregiverPhone.trim() || null,
        push_notifications_enabled: push,
        affirmation_notifications_enabled: aff,
      });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Preferences saved");
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">Patient preferences</div>
      <Field label="Caregiver WhatsApp number">
        <input
          value={caregiverPhone}
          onChange={(e) => setCaregiverPhone(e.target.value)}
          className={inp}
          placeholder="+60 11-2345 6789"
        />
      </Field>
      <Toggle label="In-app reminders" checked={push} onChange={setPush} />
      <Toggle label="Affirmation messages" checked={aff} onChange={setAff} />
      <button
        onClick={save}
        disabled={busy}
        className="w-full bg-green text-white font-bold py-3 rounded-xl mt-3 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save preferences"}
      </button>
    </section>
  );
}

const inp = "w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-fs-xs font-bold text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between py-2.5 px-1 border-t border-border first:border-t-0"
    >
      <span className="text-fs-sm font-semibold">{label}</span>
      <span
        className={`w-11 h-6 rounded-full relative transition-colors ${checked ? "bg-green" : "bg-input-bg border border-border"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}