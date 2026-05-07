import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/ping/AppShell";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { useT_hook } from "@/store/usePingStore";
import { usePingStore } from "@/store/usePingStore";
import { usePatients } from "@/lib/patientContext";
import { deleteMyAccount } from "@/server/account.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MediSync" },
      { name: "description", content: "Manage your profile, notifications, and supervisor contact." },
    ],
  }),
  component: SettingsPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

function SettingsPage() {
  const t = useT_hook();
  const { profile, session, loading, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (!profile) {
    return (
      <AppShell title={t("settings_title")}>
        <div className="flex-1 px-4 pt-4 pb-24 text-center text-muted-foreground text-fs-sm">{t("settings_loading")}</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("settings_title")}>
      <div className="flex-1 px-4 pt-4 pb-24 space-y-5">
        <ProfileCard onSaved={refresh} />
        <EmailCard />
        <PasswordCard />
        <DisplayPrefsCard />
        <LinkAccountCard />
        {profile.role === "patient" && <PatientPrefsCard patientId={profile.id} />}
        <DangerZoneCard />
      </div>
    </AppShell>
  );
}

function DisplayPrefsCard() {
  const t = useT_hook();
  const { timeFormat, setTimeFormat } = usePingStore();
  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">Display</div>
      <div className="text-fs-xs font-bold text-muted-foreground mb-2">Time format</div>
      <div className="flex gap-2">
        {(["12h", "24h"] as const).map((opt) => {
          const active = timeFormat === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setTimeFormat(opt)}
              className={`flex-1 font-bold py-2.5 rounded-xl text-fs-sm border-2 transition-colors ${
                active
                  ? "bg-green text-white border-green"
                  : "bg-input-bg text-foreground border-border hover:border-green"
              }`}
            >
              {opt === "12h" ? t("time_format_12h") : t("time_format_24h")}
            </button>
          );
        })}
      </div>
      <div className="text-fs-xs text-muted-foreground mt-2">
        Applies to the global clock and all medication times.
      </div>
    </section>
  );
}

function ProfileCard({ onSaved }: { onSaved: () => Promise<void> }) {
  const t = useT_hook();
  const { profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = profileSchema.safeParse({ full_name: fullName, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
      .eq("id", profile!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("settings_profile_updated"));
    await onSaved();
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">{t("settings_profile")}</div>
      <Field label={t("settings_full_name")}>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inp} />
      </Field>
      <Field label={t("settings_phone")}>
        <input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="+60 11-2345 6789" />
      </Field>
      <button onClick={save} disabled={busy} className="w-full bg-green text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-50">
        {busy ? t("settings_saving") : t("settings_save_profile")}
      </button>
    </section>
  );
}

function EmailCard() {
  const t = useT_hook();
  const { user } = useAuth();
  const currentEmail = user?.email ?? "";
  const [email, setEmail] = useState(currentEmail);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(currentEmail);
  }, [currentEmail]);

  const save = async () => {
    const trimmed = email.trim();
    const ok = z.string().email().safeParse(trimmed);
    if (!ok.success) return toast.error("Invalid email");
    if (trimmed === currentEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("settings_email_updated"));
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">{t("settings_email")}</div>
      <Field label={t("settings_email")}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inp}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </Field>
      <button
        onClick={save}
        disabled={busy || !email || email === currentEmail}
        className="w-full bg-green text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-50"
      >
        {busy ? t("settings_saving") : t("settings_update_email")}
      </button>
    </section>
  );
}

function PasswordCard() {
  const t = useT_hook();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 6) return toast.error(t("settings_password_min"));
    if (pw !== pw2) return toast.error(t("settings_password_mismatch"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw(""); setPw2("");
    toast.success(t("settings_password_updated"));
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">{t("settings_change_password")}</div>
      <Field label={t("settings_new_password")}>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inp} />
      </Field>
      <Field label={t("settings_confirm_password")}>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inp} />
      </Field>
      <button onClick={save} disabled={busy || !pw} className="w-full bg-foreground text-background font-bold py-3 rounded-xl mt-2 disabled:opacity-50">
        {busy ? t("settings_updating") : t("settings_update_password")}
      </button>
    </section>
  );
}

function PatientPrefsCard({ patientId }: { patientId: string }) {
  const t = useT_hook();
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
      // Auto-fill the linked supervisor's phone if the user hasn't set one yet.
      const { data: links } = await supabase
        .from("patients_supervisors")
        .select("supervisor_id")
        .eq("patient_id", patientId)
        .limit(1);
      const supId = links?.[0]?.supervisor_id;
      if (supId) {
        const { data: sup } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", supId)
          .maybeSingle();
        const supPhone = sup?.phone?.trim();
        if (supPhone && !data?.caregiver_phone) {
          setCaregiverPhone(supPhone);
        }
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
    toast.success(t("settings_prefs_saved"));
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">{t("settings_patient_prefs")}</div>
      <Field label={t("settings_caregiver_phone")}>
        <input value={caregiverPhone} onChange={(e) => setCaregiverPhone(e.target.value)} className={inp} placeholder="+60 11-2345 6789" />
      </Field>
      <Toggle label={t("settings_in_app")} checked={push} onChange={setPush} />
      <Toggle label={t("settings_affirmations")} checked={aff} onChange={setAff} />
      <button onClick={save} disabled={busy} className="w-full bg-green text-white font-bold py-3 rounded-xl mt-3 disabled:opacity-50">
        {busy ? t("settings_saving") : t("settings_save_prefs")}
      </button>
    </section>
  );
}

function LinkAccountCard() {
  const t = useT_hook();
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">{t("link_tab")}</div>
      {profile.role === "patient" ? <LinkPatientInner /> : <LinkSupervisorInner />}
    </section>
  );
}

function LinkPatientInner() {
  const t = useT_hook();
  const { profile } = useAuth();
  const code = profile?.invite_code ?? "------";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("link_copied"));
    } catch {
      toast.error(t("link_copy_failed"));
    }
  };
  return (
    <div>
      <p className="text-fs-xs text-muted-foreground mb-3">{t("link_invite_sub")}</p>
      <div className="bg-input-bg rounded-xl p-4 text-center mb-2">
        <div className="text-fs-xs uppercase tracking-wider text-hint font-bold mb-1">{t("link_code")}</div>
        <div className="font-display text-[2.2rem] font-semibold tracking-[0.35rem] text-green leading-none">
          {code}
        </div>
      </div>
      <button onClick={copy} className="w-full bg-green-l text-green font-bold py-2.5 rounded-xl text-fs-sm">
        {t("link_copy")}
      </button>
    </div>
  );
}

function LinkSupervisorInner() {
  const t = useT_hook();
  const { patients, refresh, setSelectedId } = usePatients();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ageDrafts, setAgeDrafts] = useState<Record<string, string>>({});
  const [savingAge, setSavingAge] = useState<string | null>(null);

  const submit = async () => {
    const cleaned = code.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length !== 6) return toast.error(t("link_enter_code"));
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_invite_code", { _code: cleaned });
      if (error) throw error;
      toast.success(t("link_patient_linked"));
      setCode("");
      await refresh();
      if (data) setSelectedId(data as string);
    } catch (e: any) {
      toast.error(e?.message?.includes("Invalid") ? t("link_invalid") : e?.message ?? t("link_failed"));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (id: string, name: string) => {
    if (!confirm(`${t("link_unlink_confirm")} ${name}?`)) return;
    const { error } = await supabase.from("patients_supervisors").delete().eq("patient_id", id);
    if (error) return toast.error(error.message);
    toast.success(t("link_unlinked"));
    await refresh();
  };

  const saveAge = async (patientId: string) => {
    const raw = ageDrafts[patientId]?.trim();
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 130) return toast.error(t("link_age_invalid"));
    setSavingAge(patientId);
    const { error } = await supabase.from("profiles").update({ age: n }).eq("id", patientId);
    setSavingAge(null);
    if (error) return toast.error(error.message);
    toast.success(t("link_age_saved"));
    setAgeDrafts((d) => ({ ...d, [patientId]: "" }));
    await refresh();
  };

  return (
    <div>
      <p className="text-fs-xs text-muted-foreground mb-3">{t("link_caregiver_sub")}</p>
      <input
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        className="w-full bg-input-bg border border-border rounded-xl px-3 py-3 text-center font-display text-fs-lg font-semibold tracking-[0.3rem]"
      />
      <button
        onClick={submit}
        disabled={busy || code.length !== 6}
        className="w-full mt-2 bg-green text-white font-bold py-2.5 rounded-xl disabled:opacity-50 text-fs-sm"
      >
        {busy ? t("link_linking") : t("link_link_btn")}
      </button>

      <div className="font-extrabold text-fs-xs mt-4 mb-2 uppercase tracking-wider text-muted-foreground">
        {t("link_linked_patients")} ({patients.length})
      </div>
      {patients.length === 0 ? (
        <div className="text-fs-xs text-muted-foreground text-center py-3">{t("link_no_patients")}</div>
      ) : (
        patients.map((p) => (
          <div key={p.id} className="border border-border rounded-xl p-3 mb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-fs-sm truncate">{p.full_name}</div>
                <div className="text-fs-xs text-muted-foreground">
                  {t("link_age_label")}: {p.age ?? "—"}
                </div>
              </div>
              <button
                onClick={() => unlink(p.id, p.full_name)}
                className="text-red text-fs-xs font-bold px-2 py-1 rounded-lg hover:bg-red-l shrink-0"
              >
                {t("link_unlink")}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={130}
                value={ageDrafts[p.id] ?? ""}
                onChange={(e) => setAgeDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                placeholder={t("link_age_placeholder")}
                className="flex-1 bg-input-bg border border-border rounded-lg px-2 py-1.5 text-fs-xs"
              />
              <button
                onClick={() => saveAge(p.id)}
                disabled={savingAge === p.id || !ageDrafts[p.id]}
                className="bg-green text-white font-bold text-fs-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {savingAge === p.id ? "…" : t("link_age_save")}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const inp = "w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-fs-sm";

function SupervisorWhatsAppCard({ patientId }: { patientId: string }) {
  const t = useT_hook();
  const [phones, setPhones] = useState<{ name: string; phone: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: links } = await supabase
        .from("patients_supervisors")
        .select("supervisor_id")
        .eq("patient_id", patientId);
      const ids = (links ?? []).map((l) => l.supervisor_id);
      if (ids.length === 0) return setPhones([]);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      setPhones(
        (profs ?? [])
          .filter((p) => p.phone && p.phone.trim())
          .map((p) => ({ name: p.full_name, phone: p.phone as string })),
      );
    })();
  }, [patientId]);

  if (phones.length === 0) return null;
  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border">
      <div className="font-extrabold text-fs-sm mb-3">{t("settings_supervisor_contacts")}</div>
      <div className="space-y-2">
        {phones.map((p) => {
          const num = p.phone.replace(/\D+/g, "").replace(/^0+/, "");
          return (
            <a
              key={p.phone}
              href={`https://wa.me/${num}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-green-l text-green font-bold py-3 px-4 rounded-xl"
            >
              <span className="truncate">💬 {p.name}</span>
              <span className="text-fs-xs">{t("settings_whatsapp_open")}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function DangerZoneCard() {
  const t = useT_hook();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  const doDelete = async () => {
    if (text.trim().toUpperCase() !== "DELETE") {
      toast.error(t("danger_type_delete"));
      return;
    }
    setBusy(true);
    try {
      // Try server function first (uses admin client). Fall back to RPC.
      try {
        await deleteMyAccount();
      } catch (serverErr) {
        const { error: rpcErr } = await supabase.rpc("delete_user_account");
        if (rpcErr) throw serverErr;
      }
      await supabase.auth.signOut();
      toast.success(t("danger_deleted"));
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete account");
      setBusy(false);
    }
  };

  return (
    <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border-2 border-red">
      <div className="font-extrabold text-fs-sm mb-1 text-red">⚠ {t("danger_zone")}</div>
      <p className="text-fs-xs text-muted-foreground mb-3">{t("danger_desc")}</p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full bg-red text-white font-bold py-3 rounded-xl text-fs-sm"
        >
          {t("danger_delete_account")}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-fs-xs font-bold text-red">{t("danger_confirm_prompt")}</p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            className={inp}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirming(false); setText(""); }}
              disabled={busy}
              className="flex-1 bg-input-bg border border-border font-bold py-2.5 rounded-xl text-fs-sm"
            >
              {t("cancel")}
            </button>
            <button
              onClick={doDelete}
              disabled={busy}
              className="flex-1 bg-red text-white font-bold py-2.5 rounded-xl text-fs-sm disabled:opacity-50"
            >
              {busy ? "…" : t("danger_delete_account")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

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
      <span className={`w-11 h-6 rounded-full relative transition-colors ${checked ? "bg-green" : "bg-input-bg border border-border"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
