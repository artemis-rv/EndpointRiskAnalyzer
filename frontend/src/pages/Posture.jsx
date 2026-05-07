import { useEffect, useState } from "react";
import { getLatestInterpretation, getLatestPosture, downloadOrganizationReportPDF } from "../api/api";
import { formatDateTimeIST } from "../utils/dateUtils";
import { BarChart2, ShieldAlert, ShieldCheck, AlertOctagon, Crosshair, Info } from "lucide-react";


/* ═══════════════════════════════════════════════
   Donut / Arc Gauge
   ═══════════════════════════════════════════════ */
function DonutGauge({ value = 0, size = 180, strokeWidth = 14 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  let strokeColor = "#ef4444";
  if (value >= 70) strokeColor = "#22c55e";
  else if (value >= 45) strokeColor = "#f97316";
  else if (value >= 30) strokeColor = "#eab308";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          className="stroke-slate-200 dark:stroke-white/[0.06]"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontSize: 32, fontWeight: 900, color: strokeColor, lineHeight: 1 }}>
          {value.toFixed(2)}%
        </span>
        <span className="text-slate-500 dark:text-slate-500 mt-1"
          style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Compliance
        </span>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   Icon Container — renders Lucide icon inside
   a tinted rounded-square box
   ═══════════════════════════════════════════════ */
function IconBox({ icon: Icon, color, glow = false, pulse = false }) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{
        width: 28, height: 28,
        borderRadius: 6,
        background: `${color}1F`, /* ~12% opacity */
        boxShadow: glow ? `0 0 8px ${color}4D` : "none",
      }}
    >
      <Icon size={18} strokeWidth={1.75} color={color} />
    </div>
  );
}


/* ═══════════════════════════════════════════════
   Observation classifier — picks Lucide icon,
   color, and glow based on text content
   ═══════════════════════════════════════════════ */
function classifyObservation(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("CRITICAL CIS") || (t.includes("CRITICAL") && t.includes("CIS")))
    return { color: "#a855f7", icon: AlertOctagon, glow: true, pulse: false };
  if (t.includes("HIGH"))
    return { color: "#ef4444", icon: ShieldAlert, glow: true, pulse: false };
  if (t.includes("MEDIUM"))
    return { color: "#f97316", icon: ShieldCheck, glow: false, pulse: true };
  if (t.includes("CONTROL FAILURE") || t.includes("HOTSPOT"))
    return { color: "#64748b", icon: Crosshair, glow: false, pulse: false };
  return { color: "#6366f1", icon: BarChart2, glow: false, pulse: false };
}


/* ═══════════════════════════════════════════════
   Stat Card with hover animation
   ═══════════════════════════════════════════════ */
function StatCard({ label, value, accent }) {
  return (
    <div
      className="
        bg-white dark:bg-slate-800
        border border-slate-200 dark:border-white/[0.07]
        rounded-xl
        transition-all duration-300 ease-out
        hover:scale-[1.04] hover:shadow-lg
        cursor-default
        group
      "
      style={{ borderLeftWidth: 3, borderLeftColor: accent, padding: "18px 20px" }}
    >
      <p className="text-slate-500 dark:text-slate-500 mb-1"
        style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </p>
      <p className="transition-colors duration-300"
        style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: accent }}>
        {value}
      </p>
      {/* Animated bottom-border glow on hover */}
      <div
        className="mt-3 h-[2px] rounded-full transition-all duration-500 opacity-0 group-hover:opacity-100 scale-x-0 group-hover:scale-x-100 origin-left"
        style={{ background: accent }}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════════
   Main Posture Page Component
   ═══════════════════════════════════════════════ */
export default function Posture() {
  const [data, setData] = useState(null);
  const [livePosture, setLivePosture] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleDownloadReport = async () => {
    try {
      const blob = await downloadOrganizationReportPDF();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `organization_security_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert("Failed to download PDF report.");
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [interp, posture] = await Promise.all([
          getLatestInterpretation(),
          getLatestPosture(),
        ]);
        setData(interp.status === "empty" ? null : interp);
        setLivePosture(posture?.live_summary || null);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const interp = data?.interpretation;
  const overview = interp?.organization_overview ?? interp;
  const keyObservations = livePosture?.key_observations?.length
    ? livePosture.key_observations
    : interp?.key_observations || [];
  const contextNotes = interp?.context_notes || [];
  const liveSummary = livePosture?.summary || {};

  const complianceScore = liveSummary.average_compliance_score ?? 0;

  const gradeText = overview?.overall_security_health || "STABLE";
  const isCritical = ["CRITICAL", "UNSTABLE", "AT RISK"].includes(gradeText);
  const isMedium = ["MODERATE", "MODERATE RISK", "FAIR"].includes(gradeText);
  const gradeColor = isCritical ? "#ef4444" : isMedium ? "#f97316" : "#22c55e";
  const gradeSubtext = isCritical
    ? "Immediate action required"
    : isMedium
      ? "Attention needed"
      : "Security posture is strong";
  const gradeSubIcon = isCritical ? ShieldAlert : isMedium ? ShieldCheck : BarChart2;
  const GradeSubIcon = gradeSubIcon;

  const statsCards = [
    {
      label: "Live Compliance Score",
      value: `${complianceScore}%`,
      accent: complianceScore < 45 ? "#ef4444" : complianceScore < 70 ? "#f97316" : "#22c55e",
    },
    {
      label: "Compliance Band",
      value: liveSummary.compliance_band || "N/A",
      accent: liveSummary.compliance_band === "Critical" ? "#ef4444"
        : liveSummary.compliance_band === "At Risk" ? "#f97316"
          : liveSummary.compliance_band === "Moderate Risk" ? "#f97316"
            : "#22c55e",
    },
    {
      label: "High Risk Endpoints",
      value: liveSummary.risk_distribution?.high ?? 0,
      accent: (liveSummary.risk_distribution?.high ?? 0) > 0 ? "#ef4444" : "#22c55e",
    },
    {
      label: "Critical CIS Failures",
      value: liveSummary.total_critical_failures ?? 0,
      accent: (liveSummary.total_critical_failures ?? 0) > 0 ? "#a855f7" : "#22c55e",
    },
  ];

  /* ─── Highlight keywords ─── */
  const highlightObservation = (text) => {
    if (!text || typeof text !== "string") return text;
    const parts = text.split(/(\b\d+(?:\.\d+)?%?\b|HIGH|MEDIUM|LOW|CRITICAL|At Risk|Hardened|Moderate Risk)/gi);
    return parts.map((part, idx) => {
      const isKey = /^(?:\d+(?:\.\d+)?%?|HIGH|MEDIUM|LOW|CRITICAL|At Risk|Hardened|Moderate Risk)$/i.test(part);
      if (!isKey) return <span key={idx}>{part}</span>;

      let kwColor = "#6b7280";
      const upper = part.toUpperCase();
      if (upper === "HIGH" || upper === "CRITICAL") kwColor = "#ef4444";
      else if (upper === "MEDIUM" || upper === "AT RISK" || upper === "MODERATE RISK") kwColor = "#f97316";
      else if (upper === "LOW" || upper === "HARDENED") kwColor = "#22c55e";
      else kwColor = "#818cf8";

      return (
        <span
          key={idx}
          style={{
            fontWeight: 900,
            color: kwColor,
            background: `${kwColor}15`,
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {part}
        </span>
      );
    });
  };


  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="mx-auto grid gap-6" style={{ maxWidth: 1400, padding: 24 }}>

        {/* ═══ HEADER BAR ═══ */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-200 dark:border-white/[0.07]">
          <h1 className="text-[22px] font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">
            Organizational Security Posture
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {data && (
              <span className="
                text-[11px] font-bold text-slate-500 dark:text-slate-500
                bg-slate-100 dark:bg-white/[0.04]
                border border-slate-200 dark:border-white/[0.07]
                rounded-lg px-3 py-1.5
              ">
                {formatDateTimeIST(data.generated_at)}
              </span>
            )}
            <button
              onClick={handleDownloadReport}
              className="
                bg-transparent
                border border-slate-300 dark:border-white/[0.15]
                rounded-lg px-4 py-2
                text-[13px] font-bold
                text-slate-700 dark:text-slate-300
                hover:border-indigo-400 dark:hover:border-indigo-400
                hover:text-indigo-600 dark:hover:text-indigo-300
                transition-all duration-200
                cursor-pointer
              "
            >
              Download Organization Report
            </button>
          </div>
        </div>


        {/* ═══ LOADING / EMPTY ═══ */}
        {loading && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.07] rounded-xl p-12 text-center">
            <p className="text-slate-500 dark:text-slate-500 text-sm animate-pulse">
              Loading posture interpretation...
            </p>
          </div>
        )}

        {!loading && !data && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.07] rounded-xl p-12 text-center">
            <p className="text-slate-500 dark:text-slate-500 text-sm">
              No security health data available yet. Click "Run Security Check" from the Home page to generate.
            </p>
          </div>
        )}


        {!loading && data && (
          <>
            {/* ═══ OVERVIEW CARD ═══ */}
            <div className="
              bg-white dark:bg-slate-800
              border border-slate-200 dark:border-white/[0.07]
              rounded-xl p-6
              grid items-center gap-8
            " style={{ gridTemplateColumns: "1fr auto" }}>
              {/* Left column */}
              <div>
                <p className="text-slate-500 dark:text-slate-500 mb-1"
                  style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Security Posture Grade
                </p>
                <p style={{ fontSize: 36, fontWeight: 900, color: gradeColor, lineHeight: 1, marginBottom: 10, marginTop: 4 }}>
                  {gradeText}
                </p>

                {/* Warning badge with Lucide icon */}
                <span className="inline-flex items-center gap-1.5 rounded-md text-[11px] font-bold px-3 py-1 mb-4"
                  style={{
                    color: gradeColor,
                    background: `${gradeColor}15`,
                    border: `1px solid ${gradeColor}30`,
                  }}>
                  <GradeSubIcon size={13} strokeWidth={2} color={gradeColor} />
                  {gradeSubtext}
                </span>

                {/* Pill tags */}
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="
                    text-xs font-semibold
                    text-slate-600 dark:text-slate-400
                    bg-slate-100 dark:bg-white/[0.04]
                    border border-slate-200 dark:border-white/[0.08]
                    rounded-full px-3.5 py-1
                  ">
                    Hosts analyzed: {overview?.total_hosts_analyzed ?? "N/A"}
                  </span>
                  <span className="
                    text-xs font-semibold
                    text-slate-600 dark:text-slate-400
                    bg-slate-100 dark:bg-white/[0.04]
                    border border-slate-200 dark:border-white/[0.08]
                    rounded-full px-3.5 py-1
                  ">
                    Scope: {overview?.analysis_scope ?? "N/A"}
                  </span>
                </div>
              </div>

              {/* Right column — Donut Gauge */}
              {livePosture?.status === "success" && (
                <DonutGauge value={complianceScore} />
              )}
            </div>


            {/* ═══ STATS ROW ═══ */}
            {livePosture?.status === "success" && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((card, i) => (
                  <StatCard key={i} label={card.label} value={card.value} accent={card.accent} />
                ))}
              </div>
            )}


            {/* ═══ KEY OBSERVATIONS ═══ */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.07] rounded-xl p-6">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                Key Observations
              </h2>

              {keyObservations.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">No observations available.</p>
              )}

              {keyObservations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {keyObservations.map((obs, idx) => {
                    const text = typeof obs === "string" ? obs : JSON.stringify(obs);
                    const cls = classifyObservation(text);
                    return (
                      <div key={idx} className="
                        flex items-start gap-2.5
                        bg-slate-50 dark:bg-white/[0.02]
                        border border-slate-200 dark:border-white/[0.06]
                        rounded-[10px] p-3.5
                      " style={{ borderLeftWidth: 3, borderLeftColor: cls.color }}>
                        <IconBox icon={cls.icon} color={cls.color} glow={cls.glow} pulse={cls.pulse} />
                        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed m-0 font-medium">
                          {highlightObservation(text)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* ═══ CONTEXT & LIMITATIONS ═══ */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.07] rounded-xl p-6">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
                Context & Limitations
              </h2>

              {contextNotes.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">No context notes available.</p>
              )}

              {contextNotes.length > 0 && (
                <div className="flex flex-col gap-2">
                  {contextNotes.map((note, idx) => (
                    <div key={idx} className="
                      flex items-start gap-2.5
                      bg-slate-50/60 dark:bg-white/[0.015]
                      border border-slate-200/70 dark:border-white/[0.04]
                      rounded-lg p-3
                    " style={{ borderLeftWidth: 3, borderLeftColor: "rgba(107,114,128,0.4)" }}>
                      <div className="flex items-center justify-center shrink-0"
                        style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(107,114,128,0.1)" }}>
                        <Info size={18} strokeWidth={1.75} className="text-slate-400 dark:text-slate-500" />
                      </div>
                      <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed m-0 opacity-[0.65]">
                        {typeof note === "string" ? note : JSON.stringify(note)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
