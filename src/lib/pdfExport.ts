import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

interface ExportArgs {
  patientId: string;
  patientName: string;
  patientAge: number | null;
}

/** Format YYYY-MM-DD for filenames + heading dates. */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtRowDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtRowTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

/**
 * Generates a 30-day adherence PDF for a single patient and triggers download.
 * First line is the bold centered heading per spec:
 *   [Patient Name], Age: [Age] | Adherence Report: [Start Date] to [End Date]
 */
export async function exportAdherencePdf({ patientId, patientName, patientAge }: ExportArgs): Promise<void> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  const { data, error } = await supabase
    .from("medication_logs")
    .select("due_at, status, confirmed_at, medications(med_name, scheduled_time)")
    .eq("patient_id", patientId)
    .gte("due_at", start.toISOString())
    .lte("due_at", end.toISOString())
    .order("due_at", { ascending: false });

  if (error) throw error;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Bold centered heading on the absolute first line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const ageStr = patientAge != null ? String(patientAge) : "—";
  const headingLine = `${patientName}, Age: ${ageStr} | Adherence Report: ${fmtDate(start)} to ${fmtDate(end)}`;
  doc.text(headingLine, pageWidth / 2, 40, { align: "center" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 56, { align: "center" });

  type Row = { due_at: string; status: string; medications: { med_name: string; scheduled_time: string } | { med_name: string; scheduled_time: string }[] | null };
  const rows = ((data ?? []) as Row[]).map((r) => {
    const m = Array.isArray(r.medications) ? r.medications[0] : r.medications;
    const medName = m?.med_name ?? "Medication";
    const sched = m?.scheduled_time ? m.scheduled_time.slice(0, 5) : "—";
    const status = r.status === "confirmed" ? "Confirmed" : r.status === "missed" ? "Missed" : "Pending";
    return [fmtRowDate(r.due_at), medName, sched, status];
  });

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.text("No medication logs in this period.", pageWidth / 2, 100, { align: "center" });
  } else {
    autoTable(doc, {
      startY: 78,
      head: [["Date", "Medication", "Scheduled Time", "Status"]],
      body: rows,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const v = String(data.cell.raw ?? "");
          if (v === "Confirmed") data.cell.styles.textColor = [16, 185, 129];
          else if (v === "Missed") data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });
  }

  const safeName = patientName.replace(/[^a-zA-Z0-9_-]+/g, "_");
  doc.save(`${safeName}_Adherence_${fmtDate(end)}.pdf`);
}