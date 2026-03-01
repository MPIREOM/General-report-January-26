import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { Resend } from "resend";
import type { ParsedData } from "@/lib/parser";
import { buildEmailHtml } from "@/lib/email";

const BLOB_KEY = "mpire-dashboard.json";

const SAMPLE_DATA: ParsedData = {
  dashboard: {
    months: ["JANUARY 26", "FEBRUARY 26"],
    totalDue: [12500, 12500],
    totalCollected: [11200, 10800],
    totalOutstanding: [1300, 1700],
    collectionRate: [0.896, 0.864],
    unitsPaid: ["44/50", "42/50"],
    unpaidPrev: [800, 1300],
    mpireDue: [7500, 7500],
    mpireCollected: [7100, 6800],
    mpireOutstanding: [400, 700],
    ownerDue: [5000, 5000],
    ownerCollected: [4100, 4000],
    ownerOutstanding: [900, 1000],
  },
  tenants: [
    { id: 1, unit: "G-01", name: "Ahmed Al-Rashid", rent: 250, gateway: "Bank Transfer", paidTo: "MPIRE", status: "Active" },
    { id: 2, unit: "G-02", name: "Fatima Hassan", rent: 250, gateway: "Bank Transfer", paidTo: "MPIRE", status: "Active" },
    { id: 3, unit: "1-01", name: "Omar Khalil", rent: 250, gateway: "Cash", paidTo: "OWNER", status: "Active" },
  ],
  months: ["JANUARY 26", "FEBRUARY 26"],
  monthlySheets: {
    "FEBRUARY 26": [
      { unit: "G-01", tenant: "Ahmed Al-Rashid", due: 250, paid: 250, balance: 0, status: "Paid", paidTo: "MPIRE", daysLate: 0, prevBalance: 0 },
      { unit: "G-02", tenant: "Fatima Hassan", due: 250, paid: 100, balance: 150, status: "Partial", paidTo: "MPIRE", daysLate: 5, prevBalance: 0 },
      { unit: "1-01", tenant: "Omar Khalil", due: 250, paid: 0, balance: 250, status: "Pending", paidTo: "OWNER", daysLate: 12, prevBalance: 200 },
    ],
  },
  paymentHistory: [
    { unit: "G-01", tenant: "Ahmed Al-Rashid", history: ["✓", "✓"], timesLate: 0, avgDaysLate: 0 },
    { unit: "G-02", tenant: "Fatima Hassan", history: ["✓", "◐"], timesLate: 1, avgDaysLate: 5 },
    { unit: "1-01", tenant: "Omar Khalil", history: ["✗", "✗"], timesLate: 2, avgDaysLate: 15 },
  ],
  vacancy: { totalUnits: 50, vacant: 2, occupancy: 0.96 },
};

async function fetchDashboardData(): Promise<{ data: ParsedData; source: "live" | "sample" }> {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (blobs.length) {
      const res = await fetch(blobs[0].url);
      const data: ParsedData = await res.json();
      if (data?.dashboard) {
        return { data, source: "live" };
      }
    }
  } catch {}
  return { data: SAMPLE_DATA, source: "sample" };
}

export async function POST(req: Request) {
  let emailTo: string;

  try {
    const body = await req.json();
    emailTo = body.to;
  } catch {
    return NextResponse.json({ error: "Request body must include { to: \"email@example.com\" }" }, { status: 400 });
  }

  if (!emailTo || !emailTo.includes("@")) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured. Add it to your .env.local file." }, { status: 500 });
  }

  const { data: emailData, source } = await fetchDashboardData();
  const html = buildEmailHtml(emailData);

  // Determine report month (same logic as buildEmailHtml):
  // 1st of month → previous month, otherwise → current month
  const moNames = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const now = new Date();
  let tm = now.getMonth(), ty = now.getFullYear();
  if (now.getDate() === 1) { tm--; if (tm < 0) { tm = 11; ty--; } }
  const targetName = `${moNames[tm]} ${String(ty).slice(-2)}`;
  const months = emailData.dashboard!.months;
  const ti = months.findIndex((m) => m.toUpperCase() === targetName);
  const cm = months[ti >= 0 ? ti : months.length - 1];

  try {
    const resend = new Resend(resendKey);
    const subjectPrefix = source === "sample" ? "[SAMPLE DATA] " : "";
    const { data, error } = await resend.emails.send({
      from: process.env.REPORT_EMAIL_FROM || "MPIRE Reports <reports@resend.dev>",
      to: emailTo.split(",").map((e) => e.trim()),
      subject: `${subjectPrefix}Bousher Report — ${cm} · ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      html,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sentTo: emailTo, id: data?.id, dataSource: source });
  } catch (e: any) {
    return NextResponse.json({ error: "Send failed: " + e.message }, { status: 500 });
  }
}
