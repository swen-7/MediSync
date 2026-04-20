import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/ping/AppShell";
import { useAuth } from "@/integrations/supabase/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { usePatients } from "@/lib/patientContext";

export const Route = createFileRoute("/link")({
  head: () => ({
    meta: [
      { title: "Link accounts — Ping" },
      { name: "description", content: "Link a patient and caregiver using a 6-digit invite code." },
    ],
  }),
  component: LinkPage,
});

function LinkPage() {
  const { profile, loading, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (!profile) {
    return (
      <AppShell title="Link">
        <div className="flex-1 px-4 pt-6 pb-24 text-center text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Link accounts">
      <div className="flex-1 px-4 pt-4 pb-24">
        {profile.role === "patient" ? <PatientView /> : <CaregiverView />}
      </div>
    </AppShell>
  );
}

function PatientView() {
  const { profile } = useAuth();
  const code = profile?.invite_code ?? "------";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy — please write it down");
    }
  };
  return (
    <>
      <h2 className="font-display text-fs-xl font-semibold mb-1">Your invite code</h2>
      <p className="text-fs-sm text-muted-foreground mb-4">
        Share this 6-digit code with your caregiver. They'll enter it on their phone to start
        receiving your medication updates.
      </p>
      <div className="bg-card rounded-2xl p-6 shadow-[var(--shadow-ping)] border border-border text-center mb-3">
        <div className="text-fs-xs uppercase tracking-wider text-hint font-bold mb-2">Code</div>
        <div className="font-display text-[3rem] font-semibold tracking-[0.4rem] text-green leading-none">
          {code}
        </div>
        <button
          onClick={copy}
          className="mt-4 bg-green-l text-green font-bold py-2.5 px-5 rounded-xl text-fs-sm"
        >
          📋 Copy code
        </button>
      </div>
      <p className="text-fs-xs text-muted-foreground text-center">
        Caregivers can scan multiple patients — re-using this code is safe.
      </p>
    </>
  );
}

function CaregiverView() {
  const { patients, refresh, setSelectedId } = usePatients();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const cleaned = code.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_invite_code", { _code: cleaned });
      if (error) throw error;
      toast.success("Patient linked");
      setCode("");
      await refresh();
      if (data) setSelectedId(data as string);
    } catch (e: any) {
      toast.error(e?.message?.includes("Invalid") ? "Invalid code" : e?.message ?? "Failed to link");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (id: string, name: string) => {
    if (!confirm(`Unlink ${name}?`)) return;
    const { error } = await supabase.from("patients_caregivers").delete().eq("patient_id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unlinked");
    await refresh();
  };

  return (
    <>
      <h2 className="font-display text-fs-xl font-semibold mb-1">Link a patient</h2>
      <p className="text-fs-sm text-muted-foreground mb-4">
        Ask your loved one to open <strong>Link</strong> on their phone and read you the 6-digit code.
      </p>
      <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-ping)] border border-border mb-5">
        <input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="w-full bg-input-bg border border-border rounded-xl px-3 py-4 text-center font-display text-fs-xl font-semibold tracking-[0.3rem]"
        />
        <button
          onClick={submit}
          disabled={busy || code.length !== 6}
          className="w-full mt-3 bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {busy ? "Linking…" : "Link patient"}
        </button>
      </div>

      <h3 className="font-extrabold text-fs-sm mb-2.5">
        Linked patients ({patients.length})
      </h3>
      {patients.length === 0 ? (
        <div className="bg-card rounded-2xl p-5 border border-border text-center text-muted-foreground text-fs-sm">
          No patients linked yet.
        </div>
      ) : (
        patients.map((p) => (
          <div
            key={p.id}
            className="bg-card rounded-2xl p-4 shadow-[var(--shadow-ping)] border border-border mb-2.5 flex items-center justify-between gap-2"
          >
            <div>
              <div className="font-extrabold text-fs-base">{p.full_name}</div>
              {p.phone && (
                <div className="text-fs-xs text-muted-foreground mt-0.5">{p.phone}</div>
              )}
            </div>
            <button
              onClick={() => unlink(p.id, p.full_name)}
              className="text-red text-fs-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-l"
            >
              Unlink
            </button>
          </div>
        ))
      )}
    </>
  );
}