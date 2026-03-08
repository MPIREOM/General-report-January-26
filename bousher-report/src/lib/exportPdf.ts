import type { ParsedData } from "./parser";

const COLORS = {
  primary: [20, 184, 166] as [number, number, number],
  mpire: [99, 102, 241] as [number, number, number],
  owner: [249, 115, 22] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  lightBg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
};

function fmtNum(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawHeader(doc: any, title: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pw, 22, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.text("MPIRE", 14, 14);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text("RENT COLLECTION", 14, 19);
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text(title, pw - 14, 14, { align: "right" });
}

function drawKpiCard(
  doc: any,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  accentColor: [number, number, number],
  valueColor: [number, number, number]
) {
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
  doc.setFillColor(...accentColor);
  doc.rect(x, y + 1, 2, h - 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(label.toUpperCase(), x + 7, y + 9);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...valueColor);
  doc.text(value, x + 7, y + 21);
}

function drawBarChart(
  doc: any,
  x: number, y: number, w: number, h: number,
  data: { month: string; prev: number; cur: number }[],
  prevLabel: string, curLabel: string
) {
  const chartH = h - 24;
  const chartY = y + 12;
  const maxVal = Math.max(...data.map((d) => Math.max(d.prev, d.cur)), 1);

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text("EXPENSE TREND \u2014 YEAR OVER YEAR", x + 6, y + 8);

  const gridSteps = 4;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= gridSteps; i++) {
    const gy = chartY + chartH - (i / gridSteps) * chartH;
    doc.line(x + 28, gy, x + w - 6, gy);
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.muted);
    const val = (maxVal * i) / gridSteps;
    doc.text(val >= 1000 ? `${(val / 1000).toFixed(0)}K` : String(Math.round(val)), x + 6, gy + 1.5);
  }

  const barAreaW = w - 36;
  const groupW = barAreaW / data.length;
  const barW = groupW * 0.3;
  const gap = groupW * 0.05;

  data.forEach((d, i) => {
    const gx = x + 30 + i * groupW;
    const prevH = (d.prev / maxVal) * chartH;
    const curH = (d.cur / maxVal) * chartH;
    if (d.prev > 0) {
      doc.setFillColor(...COLORS.muted);
      doc.rect(gx + gap, chartY + chartH - prevH, barW, prevH, "F");
    }
    if (d.cur > 0) {
      doc.setFillColor(...COLORS.primary);
      doc.rect(gx + gap + barW + 1, chartY + chartH - curH, barW, curH, "F");
    }
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(d.month, gx + groupW / 2, chartY + chartH + 5, { align: "center" });
  });

  const ly = y + h - 6;
  const lx = x + w / 2 - 30;
  doc.setFillColor(...COLORS.muted);
  doc.rect(lx, ly - 2, 5, 3, "F");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.muted);
  doc.text(prevLabel, lx + 7, ly);
  doc.setFillColor(...COLORS.primary);
  doc.rect(lx + 30, ly - 2, 5, 3, "F");
  doc.text(curLabel, lx + 37, ly);
}

export async function generateOwnerReport(
  data: ParsedData,
  selectedMonth: string,
) {
  // Dynamic imports to avoid SSR issues
  const jsPDFModule = await import("jspdf");
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const db = data.dashboard!;
  const months = db.months;
  const expenses = data.expenses || [];

  // ─── PAGE 1: Expenses Overview ───
  drawHeader(doc, "Expenses Overview");

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaidByOwner = expenses.reduce((s, e) => s + e.paidByOwner, 0);
  const totalPending = totalAmount - totalPaidByOwner;
  const pendingLabel = totalPending >= 0 ? "TOTAL PENDING TO MPIRE" : "TOTAL PENDING TO OWNER";
  const pendingColor = totalPending >= 0 ? COLORS.red : COLORS.green;

  const kpiW = (pw - 42) / 3;
  const kpiY = 28;
  drawKpiCard(doc, 14, kpiY, kpiW, 28, "Total Expense Amount", fmtNum(totalAmount), COLORS.text, COLORS.text);
  drawKpiCard(doc, 14 + kpiW + 7, kpiY, kpiW, 28, "Total Paid by Owner", fmtNum(totalPaidByOwner), COLORS.owner, COLORS.owner);
  drawKpiCard(doc, 14 + (kpiW + 7) * 2, kpiY, kpiW, 28, pendingLabel, fmtNum(Math.abs(totalPending)), pendingColor, pendingColor);

  const moShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const curYear = new Date().getFullYear();
  const prevYear = curYear - 1;
  const byYearMonth: Record<number, Record<number, number>> = { [prevYear]: {}, [curYear]: {} };
  expenses.forEach((e) => {
    if (!e.date) return;
    const y = Number(e.date.slice(0, 4));
    const m = Number(e.date.slice(5, 7));
    if (y === prevYear || y === curYear) {
      byYearMonth[y][m] = (byYearMonth[y][m] || 0) + e.amount;
    }
  });

  const chartData = moShort.map((label, i) => ({
    month: label,
    prev: Math.round(byYearMonth[prevYear][i + 1] || 0),
    cur: Math.round(byYearMonth[curYear][i + 1] || 0),
  }));

  drawBarChart(doc, 14, 62, pw - 28, 90, chartData, String(prevYear), String(curYear));

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.muted);
  doc.text("MPIRE Property Management \u00B7 Muscat, Oman", pw / 2, ph - 6, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pw - 14, ph - 6, { align: "right" });

  // ─── PAGE 2: Tenant Payments for Selected Month ───
  doc.addPage("a4", "landscape");
  drawHeader(doc, `Tenant Payments \u2014 ${selectedMonth}`);

  const mi = months.indexOf(selectedMonth);
  const idx = mi >= 0 ? mi : months.length - 1;
  const monthLabel = months[idx] || selectedMonth;

  const due = db.totalDue[idx] || 0;
  const collected = db.totalCollected[idx] || 0;
  const outstanding = db.totalOutstanding[idx] || 0;
  const rate = db.collectionRate[idx] || 0;

  const kpi2W = (pw - 56) / 4;
  drawKpiCard(doc, 14, 28, kpi2W, 26, "Rent Due", `${fmtNum(due)} OMR`, COLORS.primary, COLORS.text);
  drawKpiCard(doc, 14 + kpi2W + 7, 28, kpi2W, 26, "Collected", `${fmtNum(collected)} OMR`, COLORS.green, COLORS.green);
  drawKpiCard(doc, 14 + (kpi2W + 7) * 2, 28, kpi2W, 26, "Outstanding", `${fmtNum(outstanding)} OMR`, COLORS.red, COLORS.red);
  drawKpiCard(doc, 14 + (kpi2W + 7) * 3, 28, kpi2W, 26, "Collection Rate", `${(rate * 100).toFixed(1)}%`, COLORS.primary, COLORS.text);

  const mpireDue = db.mpireDue[idx] || 0;
  const mpireCol = db.mpireCollected[idx] || 0;
  const mpireOut = db.mpireOutstanding[idx] || 0;
  const ownerDue = db.ownerDue[idx] || 0;
  const ownerCol = db.ownerCollected[idx] || 0;
  const ownerOut = db.ownerOutstanding[idx] || 0;

  const splitY = 60;
  const splitW = (pw - 35) / 2;
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, splitY, splitW, 18, 2, 2, "FD");
  doc.setFillColor(...COLORS.mpire);
  doc.rect(14, splitY + 1, 2, 16, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.mpire);
  doc.text("MPIRE", 20, splitY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.text);
  doc.text(`Due: ${fmtNum(mpireDue)}`, 20, splitY + 11);
  doc.text(`Collected: ${fmtNum(mpireCol)}`, 60, splitY + 11);
  doc.text(`Outstanding: ${fmtNum(mpireOut)}`, 100, splitY + 11);

  doc.setFillColor(...COLORS.lightBg);
  doc.roundedRect(14 + splitW + 7, splitY, splitW, 18, 2, 2, "FD");
  doc.setFillColor(...COLORS.owner);
  doc.rect(14 + splitW + 7, splitY + 1, 2, 16, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.owner);
  doc.text("OWNER", 14 + splitW + 13, splitY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.text);
  doc.text(`Due: ${fmtNum(ownerDue)}`, 14 + splitW + 13, splitY + 11);
  doc.text(`Collected: ${fmtNum(ownerCol)}`, 14 + splitW + 53, splitY + 11);
  doc.text(`Outstanding: ${fmtNum(ownerOut)}`, 14 + splitW + 93, splitY + 11);

  const payments = data.monthlySheets[selectedMonth] || [];
  const activePayments = payments.filter((p: any) => p.status !== "N/A");

  const tableY = splitY + 24;

  if (activePayments.length > 0) {
    autoTable(doc, {
      startY: tableY,
      margin: { left: 14, right: 14 },
      head: [["Unit", "Tenant", "Due", "Paid", "Balance", "Status", "Days Late", "Paid To", "Prev Bal"]],
      body: activePayments.map((p: any) => [
        p.unit,
        p.tenant,
        fmtNum(p.due),
        fmtNum(p.paid),
        fmtNum(p.balance),
        p.status,
        p.daysLate > 0 ? String(p.daysLate) : "\u2014",
        p.paidTo,
        p.prevBalance ? fmtNum(p.prevBalance) : "\u2014",
      ]),
      styles: {
        fontSize: 6.5,
        cellPadding: 2,
        lineWidth: 0.1,
        lineColor: COLORS.border,
        textColor: COLORS.text,
      },
      headStyles: {
        fillColor: COLORS.dark,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 6.5,
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg,
      },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center" },
        8: { halign: "right" },
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body") {
          if (hookData.column.index === 5) {
            if (hookData.cell.raw === "Paid") hookData.cell.styles.textColor = COLORS.green;
            else if (hookData.cell.raw === "Pending") hookData.cell.styles.textColor = COLORS.red;
            else if (hookData.cell.raw === "Partial") hookData.cell.styles.textColor = COLORS.owner;
          }
          if (hookData.column.index === 7) {
            if (hookData.cell.raw === "MPIRE") hookData.cell.styles.textColor = COLORS.mpire;
            else if (hookData.cell.raw === "OWNER") hookData.cell.styles.textColor = COLORS.owner;
          }
        }
      },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.text("No payment data available for this month.", pw / 2, tableY + 10, { align: "center" });
  }

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.muted);
  doc.text("MPIRE Property Management \u00B7 Muscat, Oman", pw / 2, ph - 6, { align: "center" });
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pw - 14, ph - 6, { align: "right" });

  doc.save(`MPIRE_Owner_Report_${monthLabel.replace(/\s+/g, "_")}.pdf`);
}
