import * as XLSX from "xlsx";

export interface DashboardData {
  months: string[];
  totalDue: number[];
  totalCollected: number[];
  totalOutstanding: number[];
  collectionRate: number[];
  unitsPaid: string[];
  unpaidPrev: number[];
  mpireDue: number[];
  mpireCollected: number[];
  mpireOutstanding: number[];
  ownerDue: number[];
  ownerCollected: number[];
  ownerOutstanding: number[];
}

export interface Tenant {
  id: number;
  unit: string;
  name: string;
  rent: number;
  gateway: string;
  paidTo: string;
  status: string;
}

export interface PaymentHistoryRow {
  unit: string;
  tenant: string;
  history: string[];
  timesLate: number;
  avgDaysLate: number;
}

export interface MonthlyPayment {
  unit: string;
  tenant: string;
  due: number;
  paid: number;
  balance: number;
  status: string;
  paidTo: string;
  daysLate: number;
  prevBalance: number;
}

export interface VacancyData {
  totalUnits: number;
  vacant: number;
  occupancy: number;
}

export interface ParsedData {
  dashboard: DashboardData | null;
  tenants: Tenant[];
  months: string[];
  monthlySheets: Record<string, MonthlyPayment[]>;
  paymentHistory: PaymentHistoryRow[];
  vacancy: VacancyData | null;
}

export function parseWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedData {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const out: ParsedData = {
    dashboard: null,
    tenants: [],
    months: [],
    monthlySheets: {},
    paymentHistory: [],
    vacancy: null,
  };

  // DASHBOARD
  const dws = wb.Sheets["DASHBOARD"];
  if (dws) {
    const rows: any[][] = XLSX.utils.sheet_to_json(dws, { header: 1, defval: null });
    let hi = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === "Metric") { hi = i; break; }
    }
    if (hi >= 0) {
      const ms = rows[hi].slice(1).filter(Boolean).map(String);
      out.months = ms;
      const d: DashboardData = {
        months: ms, totalDue: [], totalCollected: [], totalOutstanding: [],
        collectionRate: [], unitsPaid: [], unpaidPrev: [],
        mpireDue: [], mpireCollected: [], mpireOutstanding: [],
        ownerDue: [], ownerCollected: [], ownerOutstanding: [],
      };
      const map: Record<string, keyof DashboardData> = {
        "Total Rent Due (OMR)": "totalDue",
        "Total Collected (OMR)": "totalCollected",
        "Total Outstanding (OMR)": "totalOutstanding",
        "Collection Rate": "collectionRate",
        "Units Paid / Total": "unitsPaid",
        "Unpaid from Prev. Month": "unpaidPrev",
        "MPIRE Rent Due": "mpireDue",
        "MPIRE Collected": "mpireCollected",
        "MPIRE Outstanding": "mpireOutstanding",
        "OWNER Rent Due": "ownerDue",
        "OWNER Collected": "ownerCollected",
        "OWNER Outstanding": "ownerOutstanding",
      };
      for (let i = hi + 1; i < rows.length; i++) {
        if (!rows[i]) continue;
        const k = map[rows[i][0]];
        if (k) (d as any)[k] = rows[i].slice(1, ms.length + 1).map((v: any) => v != null ? v : 0);
      }
      out.dashboard = d;
    }
  }

  // TENANTS
  const tws = wb.Sheets["Tenant Master"];
  if (tws) {
    const rows: any[][] = XLSX.utils.sheet_to_json(tws, { header: 1, defval: null });
    let hi = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === "#") { hi = i; break; }
    }
    if (hi >= 0) {
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r[0] == null || String(r[0]).toUpperCase() === "TOTAL") continue;
        out.tenants.push({
          id: r[0],
          unit: String(r[1] ?? ""),
          name: String(r[2] ?? "—"),
          rent: Number(r[4]) || 0,
          gateway: String(r[8] ?? ""),
          paidTo: String(r[9] ?? ""),
          status: String(r[10] ?? "Active"),
        });
      }
    }
  }

  // PAYMENT HISTORY
  const pws = wb.Sheets["Payment History"];
  if (pws) {
    const rows: any[][] = XLSX.utils.sheet_to_json(pws, { header: 1, defval: null });
    let hi = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === "Unit") { hi = i; break; }
    }
    if (hi >= 0) {
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r[0] == null) continue;
        const h: string[] = [];
        for (let j = 2; j < 2 + out.months.length; j++) {
          const v = String(r[j] ?? "");
          h.push(v.indexOf("Partial") >= 0 ? "◐" : v.indexOf("Paid") >= 0 ? "✓" : v.indexOf("Pending") >= 0 ? "✗" : "—");
        }
        out.paymentHistory.push({
          unit: String(r[0]),
          tenant: String(r[1] ?? ""),
          history: h,
          timesLate: Number(r[2 + out.months.length]) || 0,
          avgDaysLate: Number(r[3 + out.months.length]) || 0,
        });
      }
    }
  }

  // MONTHLY SHEETS
  const mp = /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{2}$/i;
  wb.SheetNames.filter((n) => mp.test(n)).forEach((sn) => {
    const ws = wb.Sheets[sn];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    let hi = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === "Unit") { hi = i; break; }
    }
    if (hi < 0) return;
    const payments: MonthlyPayment[] = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r[0] == null || String(r[0]).toUpperCase() === "TOTAL") continue;
      const st = String(r[6] ?? "");
      payments.push({
        unit: String(r[0]),
        tenant: String(r[1] ?? "—"),
        due: Number(r[2]) || 0,
        paid: Number(r[4]) || 0,
        balance: Number(r[5]) || 0,
        status: st.indexOf("Partial") >= 0 ? "Partial" : st.indexOf("Paid") >= 0 ? "Paid" : st.indexOf("Pending") >= 0 ? "Pending" : st === "N/A" ? "N/A" : st,
        paidTo: String(r[9] ?? ""),
        daysLate: Number(r[10]) || 0,
        prevBalance: Number(r[11]) || 0,
      });
    }
    out.monthlySheets[sn] = payments;
  });

  // VACANCY
  const vws = wb.Sheets["Vacancy Tracker"];
  if (vws) {
    const rows: any[][] = XLSX.utils.sheet_to_json(vws, { header: 1, defval: null });
    let tu = 50, vc = 0, oc = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      if (r[0] === "Total Units:") tu = Number(r[1]) || 50;
      if (r[3] === "Currently Vacant:") vc = Number(r[4]) || 0;
      if (r[6] === "Occupancy Rate:") oc = Number(r[7]) || 0;
    }
    out.vacancy = { totalUnits: tu, vacant: vc, occupancy: oc };
  }

  // Sync dashboard months with monthly sheets — compute aggregates for any
  // month that exists as a sheet tab but is missing from the DASHBOARD summary
  if (out.dashboard) {
    const moOrder = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
    const sortMonth = (a: string, b: string) => {
      const ap = a.split(" "), bp = b.split(" ");
      const yd = Number(ap[1]) - Number(bp[1]);
      return yd !== 0 ? yd : moOrder.indexOf(ap[0].toUpperCase()) - moOrder.indexOf(bp[0].toUpperCase());
    };
    const dbMonths = new Set(out.dashboard.months.map((m) => m.toUpperCase()));
    const sheetMonths = Object.keys(out.monthlySheets)
      .filter((m) => !dbMonths.has(m.toUpperCase()))
      .sort(sortMonth);

    for (const m of sheetMonths) {
      const payments = out.monthlySheets[m];
      const totalDue = payments.reduce((s, p) => s + p.due, 0);
      const totalCollected = payments.reduce((s, p) => s + p.paid, 0);
      const totalOutstanding = payments.reduce((s, p) => s + p.balance, 0);
      const rate = totalDue > 0 ? totalCollected / totalDue : 0;
      const paidCount = payments.filter((p) => p.status === "Paid").length;
      const totalCount = payments.filter((p) => p.status !== "N/A").length;
      const unpaidPrev = payments.reduce((s, p) => s + p.prevBalance, 0);
      const mpire = payments.filter((p) => p.paidTo === "MPIRE");
      const owner = payments.filter((p) => p.paidTo === "OWNER");

      out.dashboard.months.push(m);
      out.dashboard.totalDue.push(totalDue);
      out.dashboard.totalCollected.push(totalCollected);
      out.dashboard.totalOutstanding.push(totalOutstanding);
      out.dashboard.collectionRate.push(rate);
      out.dashboard.unitsPaid.push(`${paidCount}/${totalCount}`);
      out.dashboard.unpaidPrev.push(unpaidPrev);
      out.dashboard.mpireDue.push(mpire.reduce((s, p) => s + p.due, 0));
      out.dashboard.mpireCollected.push(mpire.reduce((s, p) => s + p.paid, 0));
      out.dashboard.mpireOutstanding.push(mpire.reduce((s, p) => s + p.balance, 0));
      out.dashboard.ownerDue.push(owner.reduce((s, p) => s + p.due, 0));
      out.dashboard.ownerCollected.push(owner.reduce((s, p) => s + p.paid, 0));
      out.dashboard.ownerOutstanding.push(owner.reduce((s, p) => s + p.balance, 0));
    }

    // Re-sort dashboard arrays so months are in chronological order
    if (sheetMonths.length > 0) {
      const indices = out.dashboard.months
        .map((m, i) => ({ m, i }))
        .sort((a, b) => sortMonth(a.m, b.m))
        .map((x) => x.i);
      const reorder = <T,>(arr: T[]) => indices.map((i) => arr[i]);
      out.dashboard.months = reorder(out.dashboard.months);
      out.dashboard.totalDue = reorder(out.dashboard.totalDue);
      out.dashboard.totalCollected = reorder(out.dashboard.totalCollected);
      out.dashboard.totalOutstanding = reorder(out.dashboard.totalOutstanding);
      out.dashboard.collectionRate = reorder(out.dashboard.collectionRate);
      out.dashboard.unitsPaid = reorder(out.dashboard.unitsPaid);
      out.dashboard.unpaidPrev = reorder(out.dashboard.unpaidPrev);
      out.dashboard.mpireDue = reorder(out.dashboard.mpireDue);
      out.dashboard.mpireCollected = reorder(out.dashboard.mpireCollected);
      out.dashboard.mpireOutstanding = reorder(out.dashboard.mpireOutstanding);
      out.dashboard.ownerDue = reorder(out.dashboard.ownerDue);
      out.dashboard.ownerCollected = reorder(out.dashboard.ownerCollected);
      out.dashboard.ownerOutstanding = reorder(out.dashboard.ownerOutstanding);
      out.months = out.dashboard.months;
    }
  }

  return out;
}
