"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart,
} from "recharts";
import { parseWorkbook, ParsedData } from "@/lib/parser";

const C = {
  bg: "#0B0F1A", card: "#111827", border: "#1e293b",
  teal: "#14b8a6", red: "#ef4444", amber: "#f59e0b", green: "#22c55e",
  text: "#f1f5f9", muted: "#94a3b8", dim: "#64748b",
  mpire: "#6366f1", owner: "#f97316",
};

function useMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return mobile;
}

const fmt = (n: any) => typeof n === "number" ? n.toLocaleString("en-US") : String(n ?? "—");
const pct = (n: any) => typeof n === "number" ? (n * 100).toFixed(1) + "%" : "—";

// ─── SUB-COMPONENTS ───

function KPI({ label, value, sub, trend, color }: { label: string; value: string; sub?: string; trend?: number; color?: string }) {
  const ac = color || C.teal;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: ac, borderRadius: "14px 0 0 14px" }} />
      <p style={{ color: C.muted, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>{label}</p>
      <p style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: "6px 0 3px" }}>{value}</p>
      {sub && <p style={{ color: C.dim, fontSize: 11, margin: 0 }}>{sub}</p>}
      {trend !== undefined && !isNaN(trend) && (
        <span style={{ position: "absolute", top: 16, right: 16, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 14, background: trend >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: trend >= 0 ? C.green : C.red }}>
          {trend >= 0 ? "↑" : "↓"}{Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

function CCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
      <p style={{ color: C.muted, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 12px" }}>{title}</p>
      {children}
    </div>
  );
}

function Hdr({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "30px 0 12px" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h2 style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>{children}</h2>
    </div>
  );
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "7px 11px" }}>
      <p style={{ color: C.text, fontSize: 11, fontWeight: 600, margin: "0 0 3px" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontSize: 10, margin: "1px 0" }}>
          {p.name}: <strong>{typeof p.value === "number" && p.value > 1 ? fmt(Math.round(p.value)) : p.value}{p.name === "Rate" ? "%" : ""}</strong>
        </p>
      ))}
    </div>
  );
}

function Bdg({ t }: { t: string }) {
  const s = t === "MPIRE" ? { bg: "rgba(99,102,241,0.15)", c: C.mpire } : t === "OWNER" ? { bg: "rgba(249,115,22,0.15)", c: C.owner } : { bg: "rgba(100,116,139,0.15)", c: C.dim };
  return <span style={{ padding: "2px 9px", borderRadius: 14, fontSize: 10, fontWeight: 600, background: s.bg, color: s.c }}>{t}</span>;
}

function HC({ v }: { v: string }) {
  const bg = v === "✓" ? "rgba(34,197,94,0.14)" : v === "✗" ? "rgba(239,68,68,0.14)" : "rgba(100,116,139,0.06)";
  const c = v === "✓" ? C.green : v === "✗" ? C.red : C.dim;
  return <td style={{ textAlign: "center", padding: "7px 4px", background: bg, color: c, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>{v}</td>;
}

function Th({ children, align }: { children: React.ReactNode; align?: string }) {
  return (
    <th style={{ padding: "10px 12px", textAlign: (align || "left") as any, color: C.muted, fontWeight: 500, fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, background: "#0f172a", position: "sticky", top: 0, zIndex: 5 }}>
      {children}
    </th>
  );
}

function Fb({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: "8px 14px", minHeight: 36, borderRadius: 7, border: `1px solid ${active ? C.teal : C.border}`, background: active ? "rgba(20,184,166,0.12)" : "transparent", color: active ? C.teal : C.muted, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

// ─── UPLOAD SCREEN ───

function UploadScreen({ onData }: { onData: (d: ParsedData) => void }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) { setErr("Please upload an .xlsx file"); return; }
    setBusy(true); setErr(null);
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const d = parseWorkbook(new Uint8Array(e.target!.result as ArrayBuffer));
        if (!d.dashboard) { setErr("Missing DASHBOARD sheet"); setBusy(false); return; }
        if (!d.tenants.length) { setErr("Missing Tenant Master data"); setBusy(false); return; }
        onData(d);
      } catch (x: any) { setErr("Error: " + x.message); setBusy(false); }
    };
    r.onerror = () => { setErr("Read failed"); setBusy(false); };
    r.readAsArrayBuffer(file);
  };

  return (
    <div className="min-h-screen-safe" style={{ background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 460, padding: "0 20px", width: "100%" }}>
        <div style={{ width: 50, height: 50, borderRadius: 13, background: `linear-gradient(135deg, ${C.teal}, ${C.mpire})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 20, fontWeight: 700, color: "#fff" }}>M</div>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>MPIRE Dashboard</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 28px" }}>Upload your rent collection report</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); go(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById("fu")?.click()}
          style={{ border: `2px dashed ${drag ? C.teal : C.border}`, borderRadius: 18, padding: "44px 32px", cursor: "pointer", background: drag ? "rgba(20,184,166,0.05)" : C.card, transition: "all 0.2s" }}
        >
          <input id="fu" type="file" accept=".xlsx,.xls" onChange={(e) => go(e.target.files?.[0])} style={{ display: "none" }} />
          {busy ? (
            <div>
              <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.teal, borderRadius: "50%", margin: "0 auto 12px", animation: "sp .8s linear infinite" }} />
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Parsing...</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 34, marginBottom: 12 }}>📊</div>
              <p style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Drop your Excel file here</p>
              <p style={{ color: C.dim, fontSize: 12, margin: "0 0 12px" }}>or click to browse</p>
              <span style={{ display: "inline-block", padding: "5px 16px", borderRadius: 7, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)", color: C.teal, fontSize: 10, fontWeight: 500 }}>Accepts .xlsx</span>
            </div>
          )}
        </div>
        {err && <div style={{ marginTop: 12, padding: "9px 16px", borderRadius: 9, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: C.red, fontSize: 11 }}>{err}</div>}
        <p style={{ color: C.dim, fontSize: 9, marginTop: 16, opacity: 0.6 }}>Expected: GENERAL_REPORT.xlsx with Dashboard, Tenant Master, Payment History sheets</p>
      </div>
    </div>
  );
}

// ─── DASHBOARD VIEW ───

function DashView({ data, onReset }: { data: ParsedData; onReset: () => void }) {
  const mob = useMobile();
  const [tab, setTab] = useState("Overview");
  const [tf, setTf] = useState("all");
  const [ts, setTs] = useState("");
  const [sm, setSm] = useState("");

  const db = data.dashboard!;
  const tenants = data.tenants;
  const ph = data.paymentHistory;
  const ms = data.monthlySheets;
  const vac = data.vacancy;
  const months = db.months;
  const ci = months.length - 1;
  const pi = ci - 1;
  const cm = months[ci];

  const rt = pi >= 0 && db.collectionRate[pi] ? ((db.collectionRate[ci] - db.collectionRate[pi]) / db.collectionRate[pi]) * 100 : 0;
  const ct = pi >= 0 && db.totalCollected[pi] ? ((db.totalCollected[ci] - db.totalCollected[pi]) / db.totalCollected[pi]) * 100 : 0;

  const rc = months.map((m, i) => ({ month: m, Due: db.totalDue[i], Collected: db.totalCollected[i] }));
  const rac = months.map((m, i) => ({ month: m, Rate: (db.collectionRate[i] || 0) * 100 }));
  const sc = months.map((m, i) => ({ month: m, MPIRE: db.mpireCollected[i] || 0, OWNER: db.ownerCollected[i] || 0 }));

  const mc = tenants.filter((t) => t.paidTo === "MPIRE" && t.status !== "Vacant").length;
  const oc = tenants.filter((t) => t.paidTo === "OWNER" && t.status !== "Vacant").length;
  const vcn = tenants.filter((t) => t.status === "Vacant").length;
  const pd = [{ name: "MPIRE", value: mc }, { name: "OWNER", value: oc }];
  if (vcn > 0) pd.push({ name: "Vacant", value: vcn });
  const pcols = [C.mpire, C.owner, C.dim];

  const ft = useMemo(() => {
    let t = tenants;
    if (tf === "mpire") t = t.filter((x) => x.paidTo === "MPIRE");
    if (tf === "owner") t = t.filter((x) => x.paidTo === "OWNER");
    if (tf === "vacant") t = t.filter((x) => x.status === "Vacant");
    if (ts) { const s = ts.toLowerCase(); t = t.filter((x) => x.name.toLowerCase().includes(s) || x.unit.toLowerCase().includes(s)); }
    return t;
  }, [tf, ts, tenants]);

  const moArr = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  const msk = Object.keys(ms).sort((a, b) => {
    const ap = a.split(" "), bp = b.split(" ");
    const yd = Number(ap[1]) - Number(bp[1]);
    return yd !== 0 ? yd : moArr.indexOf(ap[0].toUpperCase()) - moArr.indexOf(bp[0].toUpperCase());
  });
  const am = sm || (msk.length ? msk[msk.length - 1] : "");
  const ap = ms[am] || [];
  const lt = ph.filter((p) => p.timesLate >= 2);
  const tabs = ["Overview", "Monthly Detail", "Tenants", "Payment History"];

  return (
    <div className="min-h-screen-safe" style={{ background: C.bg, color: C.text }}>
      {/* HEADER */}
      <header style={{ background: "linear-gradient(135deg, #0f172a, #1a1f35)", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100 }}>
        {/* Top row: logo + info */}
        <div style={{ padding: mob ? "10px 14px" : "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.teal}, ${C.mpire})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>M</div>
            <div><h1 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>MPIRE</h1><p style={{ margin: 0, fontSize: 8, color: C.dim, letterSpacing: "0.06em" }}>RENT COLLECTION</p></div>
          </div>
          {/* Desktop tabs */}
          {!mob && (
            <div style={{ display: "flex", gap: 3, background: C.card, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, fontFamily: "inherit", background: tab === t ? C.teal : "transparent", color: tab === t ? "#fff" : C.muted }}>{t}</button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 10, color: C.dim, textAlign: "right" }}>
              <div style={{ color: C.text, fontWeight: 600 }}>{cm}</div>
              <div>{vac ? vac.totalUnits : tenants.length} Units</div>
            </div>
            <button onClick={onReset} style={{ padding: "8px 12px", minHeight: 36, borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>↻ New</button>
          </div>
        </div>
        {/* Mobile tab bar — horizontally scrollable */}
        {mob && (
          <div className="tab-scroll" style={{ padding: "0 14px 10px", gap: 6 }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", minHeight: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: tab === t ? C.teal : C.card, color: tab === t ? "#fff" : C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{t}</button>
            ))}
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: mob ? "12px 10px 32px" : "16px 24px 40px" }}>

        {/* OVERVIEW */}
        {tab === "Overview" && (
          <div>
            <div className="grid-kpi">
              <KPI label="Rent Due" value={`${fmt(db.totalDue[ci])} OMR`} sub={cm} />
              <KPI label="Collected" value={`${fmt(db.totalCollected[ci])} OMR`} sub={`${db.unitsPaid[ci]} units`} trend={ct} color={C.green} />
              <KPI label="Outstanding" value={`${fmt(db.totalOutstanding[ci])} OMR`} sub={`Prev: ${fmt(db.unpaidPrev[ci])}`} color={C.red} />
              <KPI label="Collection Rate" value={pct(db.collectionRate[ci])} trend={rt} color={db.collectionRate[ci] > 0.9 ? C.green : C.amber} />
            </div>
            <div className="grid-split" style={{ marginTop: 12 }}>
              {[{ label: "MPIRE", color: C.mpire, due: db.mpireDue[ci], col: db.mpireCollected[ci], out: db.mpireOutstanding[ci] },
                { label: "OWNER", color: C.owner, due: db.ownerDue[ci], col: db.ownerCollected[ci], out: db.ownerOutstanding[ci] }
              ].map((x) => (
                <div key={x.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: mob ? "14px 14px" : "16px 20px", borderLeft: `4px solid ${x.color}` }}>
                  <p style={{ color: C.muted, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>{x.label}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div><p style={{ color: C.dim, fontSize: 9, margin: 0 }}>Due</p><p style={{ color: C.text, fontSize: mob ? 15 : 18, fontWeight: 700, margin: "2px 0 0" }}>{fmt(x.due)}</p></div>
                    <div><p style={{ color: C.dim, fontSize: 9, margin: 0 }}>Collected</p><p style={{ color: C.green, fontSize: mob ? 15 : 18, fontWeight: 700, margin: "2px 0 0" }}>{fmt(x.col)}</p></div>
                    <div><p style={{ color: C.dim, fontSize: 9, margin: 0 }}>Outstanding</p><p style={{ color: C.red, fontSize: mob ? 15 : 18, fontWeight: 700, margin: "2px 0 0" }}>{fmt(x.out)}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <Hdr icon="📊">Revenue Trends</Hdr>
            <div className="grid-charts">
              <CCard title="Collected vs Due">
                <ResponsiveContainer width="100%" height={mob ? 180 : 210}><BarChart data={rc} barGap={3}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="month" tick={{fill:C.dim,fontSize:mob?8:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false} width={mob?35:60}/><Tooltip content={<Tip/>}/><Bar dataKey="Due" fill="#334155" radius={[3,3,0,0]}/><Bar dataKey="Collected" fill={C.teal} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
              </CCard>
              <CCard title="Collection Rate %">
                <ResponsiveContainer width="100%" height={mob ? 180 : 210}><AreaChart data={rac}><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.teal} stopOpacity={0.3}/><stop offset="95%" stopColor={C.teal} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="month" tick={{fill:C.dim,fontSize:mob?8:9}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false} width={mob?30:60}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="Rate" stroke={C.teal} fill="url(#rg)" strokeWidth={2} dot={{fill:C.teal,r:3}}/></AreaChart></ResponsiveContainer>
              </CCard>
            </div>
            <div className="grid-charts" style={{ marginTop: 12 }}>
              <CCard title="MPIRE vs OWNER">
                <ResponsiveContainer width="100%" height={mob ? 170 : 190}><BarChart data={sc} barGap={3}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="month" tick={{fill:C.dim,fontSize:mob?8:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.dim,fontSize:9}} axisLine={false} tickLine={false} width={mob?35:60}/><Tooltip content={<Tip/>}/><Bar dataKey="MPIRE" fill={C.mpire} radius={[3,3,0,0]}/><Bar dataKey="OWNER" fill={C.owner} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
              </CCard>
              <CCard title="Tenant Split">
                <ResponsiveContainer width="100%" height={150}><PieChart><Pie data={pd} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value" stroke="none">{pd.map((_,i)=><Cell key={i} fill={pcols[i]}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer>
                <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:2}}>{pd.map((d,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:C.muted}}><span style={{width:8,height:8,borderRadius:2,background:pcols[i],display:"inline-block"}}/>{d.name}: {d.value}</span>)}</div>
              </CCard>
            </div>
          </div>
        )}

        {/* MONTHLY DETAIL */}
        {tab === "Monthly Detail" && (
          <div>
            <div className="tab-scroll" style={{ margin: "12px 0", gap: 6, alignItems: "center", flexWrap: mob ? "nowrap" : "wrap", display: "flex" }}>
              <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>Month:</span>
              {msk.map((k) => <Fb key={k} active={am === k} onClick={() => setSm(k)}>{k}</Fb>)}
            </div>
            {ap.length > 0 ? (
              <div className="scroll-touch scroll-touch-x" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "auto", maxHeight: mob ? "65vh" : 420 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: mob ? 640 : "auto" }}>
                  <thead><tr>{["Unit","Tenant","Due","Paid","Bal","Status","Late","To","Prev"].map((h)=><Th key={h}>{h}</Th>)}</tr></thead>
                  <tbody>
                    {ap.filter((p)=>p.status!=="N/A").map((p,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:"8px 12px",fontWeight:600,color:C.text,whiteSpace:"nowrap"}}>{p.unit}</td>
                        <td style={{padding:"8px 12px",color:C.muted,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.tenant}</td>
                        <td style={{padding:"8px 12px",color:C.text,whiteSpace:"nowrap"}}>{fmt(p.due)}</td>
                        <td style={{padding:"8px 12px",color:p.paid>0?C.green:C.dim,whiteSpace:"nowrap"}}>{p.paid>0?fmt(p.paid):"—"}</td>
                        <td style={{padding:"8px 12px",color:p.balance>0?C.red:C.dim,fontWeight:p.balance>0?600:400,whiteSpace:"nowrap"}}>{p.balance>0?fmt(p.balance):"0"}</td>
                        <td style={{padding:"8px 12px",color:p.status==="Paid"?C.green:C.red,fontWeight:500,whiteSpace:"nowrap"}}>{p.status==="Paid"?"✓":"✗"} {p.status}</td>
                        <td style={{padding:"8px 12px",color:p.daysLate>0?C.amber:C.dim,whiteSpace:"nowrap"}}>{p.daysLate>0?p.daysLate+"d":"—"}</td>
                        <td style={{padding:"8px 12px"}}><Bdg t={p.paidTo}/></td>
                        <td style={{padding:"8px 12px",color:p.prevBalance>0?C.amber:C.dim,whiteSpace:"nowrap"}}>{p.prevBalance>0?fmt(p.prevBalance):"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p style={{color:C.dim}}>No data.</p>}
            <Hdr icon="📈">Summary</Hdr>
            <div className="scroll-touch-x" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth: mob ? 500 : "auto"}}>
                <thead><tr><Th>Metric</Th>{months.map((m)=><Th key={m} align="right">{m}</Th>)}</tr></thead>
                <tbody>
                  {[{l:"Due",d:db.totalDue},{l:"Collected",d:db.totalCollected},{l:"Outstanding",d:db.totalOutstanding},{l:"Rate",d:db.collectionRate,p:true},{l:"Units Paid",d:db.unitsPaid,s:true}].map((r:any,ri)=>(
                    <tr key={ri} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"8px 12px",fontWeight:600,color:C.text,whiteSpace:"nowrap"}}>{r.l}</td>
                      {r.d.map((v:any,vi:number)=><td key={vi} style={{padding:"8px 12px",textAlign:"right",color:r.l==="Outstanding"&&v>1000?C.red:r.p&&v<0.8?C.amber:C.muted,whiteSpace:"nowrap"}}>{r.p?pct(v):r.s?v:fmt(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TENANTS */}
        {tab === "Tenants" && (
          <div>
            <div style={{display:"flex",gap:8,margin:"12px 0",flexWrap:"wrap",alignItems:"center"}}>
              <input value={ts} onChange={(e)=>setTs(e.target.value)} placeholder="Search..." style={{padding:"10px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:13,fontFamily:"inherit",width: mob ? "100%" : 160,outline:"none",minHeight:36}}/>
              <div className="tab-scroll" style={{display:"flex",gap:6,flexWrap:mob?"nowrap":"wrap"}}>
                <Fb active={tf==="all"} onClick={()=>setTf("all")}>All ({tenants.length})</Fb>
                <Fb active={tf==="mpire"} onClick={()=>setTf("mpire")}>MPIRE ({mc})</Fb>
                <Fb active={tf==="owner"} onClick={()=>setTf("owner")}>Owner ({oc})</Fb>
                <Fb active={tf==="vacant"} onClick={()=>setTf("vacant")}>Vacant</Fb>
              </div>
            </div>
            <div className="scroll-touch scroll-touch-x" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:"auto",maxHeight: mob ? "65vh" : 440}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth: mob ? 540 : "auto"}}>
                <thead><tr>{["#","Unit","Tenant","Rent","Gateway","To","Status"].map((h)=><Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {ft.map((t)=>(
                    <tr key={t.id} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"7px 12px",color:C.dim,whiteSpace:"nowrap"}}>{t.id}</td>
                      <td style={{padding:"7px 12px",fontWeight:600,color:C.text,whiteSpace:"nowrap"}}>{t.unit}</td>
                      <td style={{padding:"7px 12px",color:t.status==="Vacant"?C.red:C.muted,whiteSpace:"nowrap"}}>{t.name}</td>
                      <td style={{padding:"7px 12px",color:C.text,fontWeight:500,whiteSpace:"nowrap"}}>{fmt(t.rent)}</td>
                      <td style={{padding:"7px 12px",color:C.muted,whiteSpace:"nowrap"}}>{t.gateway}</td>
                      <td style={{padding:"7px 12px"}}><Bdg t={t.paidTo}/></td>
                      <td style={{padding:"7px 12px",color:t.status==="Vacant"?C.red:C.green,fontWeight:500,whiteSpace:"nowrap"}}>{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{color:C.dim,fontSize:10,marginTop:6}}>{ft.length} of {tenants.length}</p>
          </div>
        )}

        {/* PAYMENT HISTORY */}
        {tab === "Payment History" && (
          <div>
            <Hdr icon="🗓️">Payment Heatmap</Hdr>
            <p style={{color:C.dim,fontSize:10,margin:"-6px 0 10px"}}><span style={{color:C.green}}>✓ Paid</span>{" · "}<span style={{color:C.red}}>✗ Pending</span>{" · "}<span style={{color:C.dim}}>— N/A</span></p>
            {ph.length>0?(
              <div className="scroll-touch scroll-touch-x" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:"auto",maxHeight: mob ? "65vh" : 420}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth: mob ? 500 : "auto"}}>
                  <thead><tr><Th>Unit</Th>{months.map((m)=><Th key={m} align="center">{m}</Th>)}<Th align="right">Late</Th><Th align="right">Avg</Th></tr></thead>
                  <tbody>
                    {ph.map((p,i)=>(
                      <tr key={i}>
                        <td style={{padding:"7px 12px",fontWeight:600,color:C.text,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{p.unit}</td>
                        {p.history.map((v,vi)=><HC key={vi} v={v}/>)}
                        <td style={{padding:"7px 12px",textAlign:"right",color:p.timesLate>0?C.amber:C.dim,fontWeight:p.timesLate>0?600:400,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{p.timesLate||"—"}</td>
                        <td style={{padding:"7px 12px",textAlign:"right",color:p.avgDaysLate>30?C.red:p.avgDaysLate>0?C.amber:C.dim,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{p.avgDaysLate?p.avgDaysLate+"d":"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ):<p style={{color:C.dim}}>No history data.</p>}
            {lt.length>0&&(
              <div>
                <Hdr icon="⚠️">At-Risk (2+ Late)</Hdr>
                <div style={{display:"grid",gridTemplateColumns: mob ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))",gap:10}}>
                  {lt.map((t,i)=>(
                    <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",borderLeft:`4px solid ${C.red}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:600,color:C.text}}>Unit {t.unit}</span><span style={{padding:"2px 6px",borderRadius:10,fontSize:9,fontWeight:600,background:"rgba(239,68,68,0.15)",color:C.red}}>{t.timesLate}x</span></div>
                      {t.tenant&&<p style={{color:C.muted,fontSize:11,margin:"3px 0 0"}}>{t.tenant}</p>}
                      {t.avgDaysLate>0&&<p style={{color:C.amber,fontSize:10,margin:"2px 0 0"}}>Avg {t.avgDaysLate}d late</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="safe-bottom" style={{borderTop:`1px solid ${C.border}`,padding: mob ? "10px 14px" : "10px 24px",textAlign:"center",color:C.dim,fontSize:9}}>MPIRE Property Management · Muscat, Oman</footer>
    </div>
  );
}

// ─── ROOT ───
const STORAGE_KEY = "mpire_dashboard_data";

export default function Dashboard() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.dashboard) {
          setData(d);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
        } else {
          try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setData(JSON.parse(raw)); } catch {}
        }
      })
      .catch(() => {
        try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setData(JSON.parse(raw)); } catch {}
      })
      .finally(() => setLoaded(true));
  }, []);

  const handleData = (d: ParsedData) => {
    setData(d);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
    fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).catch(() => {});
  };

  const handleReset = () => {
    setData(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    fetch("/api/data", { method: "DELETE" }).catch(() => {});
  };

  if (!loaded) return null;
  return data ? <DashView data={data} onReset={handleReset} /> : <UploadScreen onData={handleData} />;
}
