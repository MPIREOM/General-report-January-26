import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { Resend } from "resend";
import type { ParsedData } from "@/lib/parser";

const BLOB_KEY = "mpire-dashboard.json";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => (n * 100).toFixed(1) + "%";

function buildEmailHtml(data: ParsedData): string {
  const db = data.dashboard!;
  const months = db.months;
  const ci = months.length - 1;
  const cm = months[ci];
  const tenants = data.tenants;
  const ph = data.paymentHistory;
  const vac = data.vacancy;

  const totalUnits = vac ? vac.totalUnits : tenants.length;
  const due = db.totalDue[ci];
  const collected = db.totalCollected[ci];
  const outstanding = db.totalOutstanding[ci];
  const rate = db.collectionRate[ci];

  // Late / at-risk tenants
  const atRisk = ph.filter((p) => p.timesLate >= 2);

  // Current month's unpaid/partial tenants from latest monthly sheet
  const moArr = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const msk = Object.keys(data.monthlySheets).sort((a, b) => {
    const ap = a.split(" "), bp = b.split(" ");
    const yd = Number(ap[1]) - Number(bp[1]);
    return yd !== 0 ? yd : moArr.indexOf(ap[0].toUpperCase()) - moArr.indexOf(bp[0].toUpperCase());
  });
  const latestMonth = msk.length ? msk[msk.length - 1] : "";
  const latestPayments = data.monthlySheets[latestMonth] || [];
  const unpaid = latestPayments.filter((p) => p.status !== "Paid" && p.status !== "N/A");

  const rateColor = rate > 0.9 ? "#22c55e" : rate > 0.7 ? "#f59e0b" : "#ef4444";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0B0F1A;font-family:'Helvetica Neue',Arial,sans-serif;color:#f1f5f9;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:24px;">
    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#14b8a6,#6366f1);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;">M</div>
    <h1 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:12px 0 4px;">Weekly Rent Report</h1>
    <p style="color:#94a3b8;font-size:12px;margin:0;">${cm} · ${totalUnits} Units · Generated ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
  </div>

  <!-- KPI Cards -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <tr>
      <td width="50%" style="padding:0 4px 8px 0;">
        <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:14px 16px;border-left:4px solid #14b8a6;">
          <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0;">Rent Due</p>
          <p style="color:#f1f5f9;font-size:20px;font-weight:700;margin:4px 0 0;">${fmt(due)} <span style="font-size:11px;color:#94a3b8;">OMR</span></p>
        </div>
      </td>
      <td width="50%" style="padding:0 0 8px 4px;">
        <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:14px 16px;border-left:4px solid #22c55e;">
          <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0;">Collected</p>
          <p style="color:#22c55e;font-size:20px;font-weight:700;margin:4px 0 0;">${fmt(collected)} <span style="font-size:11px;color:#94a3b8;">OMR</span></p>
        </div>
      </td>
    </tr>
    <tr>
      <td width="50%" style="padding:0 4px 0 0;">
        <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:14px 16px;border-left:4px solid #ef4444;">
          <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0;">Outstanding</p>
          <p style="color:#ef4444;font-size:20px;font-weight:700;margin:4px 0 0;">${fmt(outstanding)} <span style="font-size:11px;color:#94a3b8;">OMR</span></p>
        </div>
      </td>
      <td width="50%" style="padding:0 0 0 4px;">
        <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:14px 16px;border-left:4px solid ${rateColor};">
          <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0;">Collection Rate</p>
          <p style="color:${rateColor};font-size:20px;font-weight:700;margin:4px 0 0;">${pct(rate)}</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- MPIRE vs OWNER -->
  <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
    <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 12px;">Breakdown</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td></td>
        <td style="color:#94a3b8;font-size:9px;text-align:right;padding-bottom:6px;">Due</td>
        <td style="color:#94a3b8;font-size:9px;text-align:right;padding-bottom:6px;">Collected</td>
        <td style="color:#94a3b8;font-size:9px;text-align:right;padding-bottom:6px;">Outstanding</td>
      </tr>
      <tr>
        <td style="padding:6px 8px 6px 0;"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:rgba(99,102,241,0.15);color:#6366f1;">MPIRE</span></td>
        <td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${fmt(db.mpireDue[ci])}</td>
        <td style="color:#22c55e;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${fmt(db.mpireCollected[ci])}</td>
        <td style="color:#ef4444;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${fmt(db.mpireOutstanding[ci])}</td>
      </tr>
      <tr style="border-top:1px solid #1e293b;">
        <td style="padding:6px 8px 6px 0;"><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:rgba(249,115,22,0.15);color:#f97316;">OWNER</span></td>
        <td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${fmt(db.ownerDue[ci])}</td>
        <td style="color:#22c55e;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${fmt(db.ownerCollected[ci])}</td>
        <td style="color:#ef4444;font-size:13px;font-weight:600;text-align:right;padding:6px 0;">${fmt(db.ownerOutstanding[ci])}</td>
      </tr>
    </table>
  </div>

  ${unpaid.length > 0 ? `
  <!-- Unpaid / Partial -->
  <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
    <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;">⚠ Unpaid / Partial — ${latestMonth} (${unpaid.length})</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;">
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="color:#94a3b8;font-size:9px;padding:6px 0;font-weight:500;">Unit</td>
        <td style="color:#94a3b8;font-size:9px;padding:6px 0;font-weight:500;">Tenant</td>
        <td style="color:#94a3b8;font-size:9px;padding:6px 0;text-align:right;font-weight:500;">Balance</td>
        <td style="color:#94a3b8;font-size:9px;padding:6px 0;text-align:right;font-weight:500;">Status</td>
      </tr>
      ${unpaid.map((p) => `
      <tr style="border-bottom:1px solid #1e293b;">
        <td style="color:#f1f5f9;font-weight:600;padding:6px 0;">${p.unit}</td>
        <td style="color:#94a3b8;padding:6px 0;">${p.tenant}</td>
        <td style="color:#ef4444;font-weight:600;text-align:right;padding:6px 0;">${fmt(p.balance)}</td>
        <td style="text-align:right;padding:6px 0;"><span style="padding:2px 6px;border-radius:10px;font-size:9px;font-weight:600;background:${p.status === "Partial" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)"};color:${p.status === "Partial" ? "#f59e0b" : "#ef4444"};">${p.status === "Partial" ? "◐ Partial" : "✗ Pending"}</span></td>
      </tr>`).join("")}
    </table>
  </div>` : ""}

  ${atRisk.length > 0 ? `
  <!-- At-Risk -->
  <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
    <p style="color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;">🔴 At-Risk Tenants (2+ Late)</p>
    ${atRisk.map((t) => `
    <div style="padding:8px 0;border-bottom:1px solid #1e293b;">
      <span style="color:#f1f5f9;font-weight:600;">Unit ${t.unit}</span>
      ${t.tenant ? `<span style="color:#94a3b8;font-size:11px;"> — ${t.tenant}</span>` : ""}
      <span style="float:right;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:600;background:rgba(239,68,68,0.15);color:#ef4444;">${t.timesLate}x late</span>
      ${t.avgDaysLate > 0 ? `<br/><span style="color:#f59e0b;font-size:10px;">Avg ${t.avgDaysLate}d late</span>` : ""}
    </div>`).join("")}
  </div>` : ""}

  <!-- Footer -->
  <div style="text-align:center;padding:16px 0;border-top:1px solid #1e293b;">
    <p style="color:#64748b;font-size:9px;margin:0;">MPIRE Property Management · Muscat, Oman</p>
    <p style="color:#64748b;font-size:9px;margin:4px 0 0;">This is an automated weekly report from your Bousher Dashboard.</p>
  </div>

</div>
</body>
</html>`;
}

export async function GET(req: Request) {
  // Auth: require a secret token to prevent unauthorized triggers
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const expectedToken = process.env.REPORT_SECRET;
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read dashboard data from Vercel Blob
  let data: ParsedData;
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (!blobs.length) {
      return NextResponse.json({ error: "No dashboard data found. Upload an Excel file first." }, { status: 404 });
    }
    const res = await fetch(blobs[0].url);
    data = await res.json();
    if (!data?.dashboard) {
      return NextResponse.json({ error: "Dashboard data is incomplete" }, { status: 404 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to read data: " + e.message }, { status: 500 });
  }

  // Build email HTML
  const html = buildEmailHtml(data);

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const emailTo = process.env.REPORT_EMAIL_TO;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }
  if (!emailTo) {
    return NextResponse.json({ error: "REPORT_EMAIL_TO not configured" }, { status: 500 });
  }

  try {
    const resend = new Resend(resendKey);
    const cm = data.dashboard!.months[data.dashboard!.months.length - 1];
    const { error } = await resend.emails.send({
      from: process.env.REPORT_EMAIL_FROM || "MPIRE Reports <reports@resend.dev>",
      to: emailTo.split(",").map((e) => e.trim()),
      subject: `MPIRE Weekly Report — ${cm} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      html,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sentTo: emailTo });
  } catch (e: any) {
    return NextResponse.json({ error: "Send failed: " + e.message }, { status: 500 });
  }
}
