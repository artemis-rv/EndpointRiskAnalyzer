import { useEffect, useState } from "react";
import {
  getEndpoints,
  triggerAnalysis,
  getLatestPosture,
  getLatestInterpretation,
  getScans,
} from "../api/api";
import Interpretation from "../components/Interpretation";
import { formatDateTimeIST } from "../utils/dateUtils";

export default function Dashboard() {
  const [endpoints, setEndpoints] = useState([]);
  const [posture, setPosture] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [loadingInterpretation, setLoadingInterpretation] = useState(true);
  const [scans, setScans] = useState({});
  const [loadingScans, setLoadingScans] = useState({});
  const [expandedScan, setExpandedScan] = useState({});
  const [showNewStatus, setShowNewStatus] = useState(false);

  useEffect(() => {
    const loadEndpoints = () =>
      getEndpoints().then((data) => setEndpoints(data.endpoints || []));
    loadEndpoints();
    const interval = setInterval(loadEndpoints, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getLatestPosture().then(setPosture);
    getLatestInterpretation()
      .then((data) => {
        setInterpretation(data.status === "empty" ? null : data);
      })
      .finally(() => setLoadingInterpretation(false));
  }, []);

  const handleTriggerAnalysis = async () => {
    try {
      await triggerAnalysis();
      setShowNewStatus(true);
      // Refresh interpretation after a short delay
      setTimeout(() => {
        getLatestInterpretation().then((data) => {
          setInterpretation(data.status === "empty" ? null : data);
        });
      }, 5000);
    } catch (error) {
      console.error("Analysis trigger failed", error);
    }
  };

  const totalEndpoints = endpoints.length;
  const activeAgents = endpoints.filter((ep) => ep.agent_active === true).length;
  const lastScan =
    posture?.generated_at ||
    posture?.latest_scan_at ||
    posture?.last_scan_at ||
    posture?.created_at ||
    interpretation?.generated_at;

  const toggleEndpointScans = (endpointId) => {
    if (selectedEndpoint === endpointId) {
      setSelectedEndpoint(null);
      return;
    }

    setSelectedEndpoint(endpointId);
    if (!scans[endpointId]) {
      setLoadingScans((prev) => ({ ...prev, [endpointId]: true }));
      getScans(endpointId)
        .then((data) => {
          setScans((prev) => ({ ...prev, [endpointId]: data.scans || [] }));
        })
        .finally(() => {
          setLoadingScans((prev) => ({ ...prev, [endpointId]: false }));
        });
    }
  };

  const toggleScanDetail = (endpointId, scanIdx) => {
    const key = `${endpointId}-${scanIdx}`;
    setExpandedScan((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getRiskColor = (riskLevel) => {
    const level = (riskLevel || "").toString().toLowerCase();
    if (level.includes("critical") || level.includes("high")) {
      return "bg-red-100 text-red-800 border-red-200";
    }
    if (level.includes("medium") || level.includes("moderate")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
    if (level.includes("low")) {
      return "bg-green-100 text-green-800 border-green-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  return (
    <div className="p-6 bg-slate-100 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Org security posture, endpoint activity, and latest scans.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleTriggerAnalysis}
            className="group px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:bg-indigo-700 hover:shadow-xl dark:hover:shadow-indigo-900/60 transition-all active:scale-95 flex items-center gap-2"
          >
            <span>Run Systemic Analysis</span>
            <svg className="w-4 h-4 text-indigo-100 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-950/20 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.02] transition-all">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Endpoints</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{totalEndpoints}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-950/20 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.02] transition-all">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Active Agents</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">
            {activeAgents || activeAgents === 0 ? activeAgents : "N/A"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-950/20 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 hover:scale-[1.02] transition-all">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Last Scan</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {formatDateTimeIST(lastScan)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Endpoints</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Displaying top 5 active endpoints.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {endpoints.length === 0 && (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic">
                No endpoints found. Make sure agents are registered.
              </div>
            )}
            {endpoints.slice(0, 5).map((ep) => (
              <div key={ep.endpoint_id}>
                {/* Endpoint Row */}
                <div className="p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {ep.hostname || "Unnamed Endpoint"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {ep.os || "Unknown OS"} • Scans: {ep.scan_count ?? 0}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleEndpointScans(ep.endpoint_id)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${selectedEndpoint === ep.endpoint_id
                      ? "bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-white border border-slate-200 dark:border-slate-600"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                  >
                    {selectedEndpoint === ep.endpoint_id ? "Hide Details" : "Scan History"}
                  </button>
                </div>

                {/* Scan History Dropdown */}
                {selectedEndpoint === ep.endpoint_id && (
                  <div className="px-5 pb-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                    <div className="pt-4">
                      {loadingScans[ep.endpoint_id] && (
                        <div className="flex items-center gap-3 text-slate-400 animate-pulse">
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                          <span className="text-xs font-medium">Fetching history...</span>
                        </div>
                      )}

                      {!loadingScans[ep.endpoint_id] && scans[ep.endpoint_id]?.length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                          No scan logs recorded for this endpoint.
                        </p>
                      )}

                      {!loadingScans[ep.endpoint_id] && scans[ep.endpoint_id]?.length > 0 && (
                        <div className="space-y-3">
                          {scans[ep.endpoint_id].map((scan, idx) => {
                            const scanKey = `${ep.endpoint_id}-${idx}`;
                            const isExpanded = expandedScan[scanKey];

                            // Prefer ML Assessment if available
                            const mlRisk = scan.ml_assessment;
                            const legacyRisk = scan.scan_data?.risk_assessment;

                            const riskLevel = mlRisk?.risk || legacyRisk?.risk_level || "N/A";
                            const riskFlags = legacyRisk?.risk_flags || []; // ML flags might be different, let's keep legacy flags for now or merge?
                            // ML Details are in mlRisk.details or mlRisk.breakdown

                            const openPorts = scan.scan_data?.exposure_posture?.open_ports || [];

                            return (
                              <div key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                <button
                                  onClick={() => toggleScanDetail(ep.endpoint_id, idx)}
                                  className="w-full p-4 flex items-center justify-between text-left transition-colors"
                                >
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                      {formatDateTimeIST(scan.scan_time)}
                                    </span>
                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-tight ${getRiskColor(riskLevel)}`}>
                                      {riskLevel}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                      {openPorts.length} PORTS
                                    </span>
                                  </div>
                                  <svg
                                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {isExpanded && (
                                  <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                      {/* Issues/Flags */}
                                      <div>
                                        <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Findings</h5>
                                        {(() => {
                                          // Extract CIS non-compliant controls
                                          const cisControls = scan.scan_data?.cis_compliance?.controls || [];
                                          const nonCompliantCIS = cisControls.filter(c => c.status === "non-compliant");

                                          // Combine risk flags and CIS findings
                                          const allFindings = [
                                            ...riskFlags.map(flag => ({ type: 'risk_flag', content: flag, priority: 999 })), // Risk flags first
                                            ...nonCompliantCIS.map(c => ({
                                              type: 'cis',
                                              control_id: c.control_id,
                                              name: c.name,
                                              severity_weight: c.severity_weight,
                                              details: c.details,
                                              priority: c.severity_weight // 3 = Critical, 2 = High, 1 = Low
                                            }))
                                          ];

                                          // Sort by priority (highest first): Risk flags → Critical → High → Low
                                          allFindings.sort((a, b) => b.priority - a.priority);

                                          if (allFindings.length === 0) {
                                            return (
                                              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No anomalies detected.</p>
                                            );
                                          }

                                          return (
                                            <ul className="space-y-1.5">
                                              {allFindings.map((finding, findingIdx) => {
                                                if (finding.type === 'risk_flag') {
                                                  return (
                                                    <li key={`risk-${findingIdx}`} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                                                      <span className="text-red-500 font-bold shrink-0">!</span>
                                                      <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight">{finding.content}</span>
                                                    </li>
                                                  );
                                                }

                                                // CIS finding
                                                const severityColor = finding.severity_weight === 3
                                                  ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                                  : finding.severity_weight === 2
                                                    ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
                                                    : "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";

                                                return (
                                                  <li key={`cis-${findingIdx}`} className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <div className="flex items-center gap-2">
                                                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight ${severityColor}`}>
                                                        CIS {finding.control_id}
                                                      </span>
                                                      <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold">{finding.name}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pl-1">{finding.details}</span>
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          );
                                        })()}
                                      </div>

                                      {/* Risk Breakdown Section */}
                                      <div>
                                        <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Internal Breakdown</h5>
                                        <div className="space-y-1.5">
                                          {/* Show only factor names, no individual scores */}
                                          {(mlRisk?.breakdown || legacyRisk?.breakdown || []).map((item, bIdx) => (
                                            <div key={bIdx} className="flex items-center text-[10px] p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                                              <span className="text-slate-600 dark:text-slate-400 font-medium">{item[0]}</span>
                                            </div>
                                          ))}
                                          {/* Keep only final Anomaly Score */}
                                          <div className="flex justify-between items-center bg-slate-900 dark:bg-primary-600 text-white p-2.5 rounded-lg shadow-md mt-4">
                                            <span className="text-[10px] font-black uppercase tracking-tight">
                                              {mlRisk ? "Anomaly Score" : "Consolidated Risk Score"}
                                            </span>
                                            <span className="text-sm font-black">
                                              {mlRisk ? mlRisk.anomaly_score?.toFixed(4) : legacyRisk?.risk_score}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Risky Ports Check - Use risky_listening_ports from exposure_posture */}
                                    {scan.scan_data?.exposure_posture?.risky_listening_ports?.length > 0 && (
                                      <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl shadow-inner-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                          <span className="text-lg">⚠️</span>
                                          <span className="text-[11px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Risky Port Exposure Detected</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {scan.scan_data.exposure_posture.risky_listening_ports.map((portInfo, pIdx) => (
                                            <div key={pIdx} className="px-3 py-2 bg-red-600 text-white text-[10px] font-black rounded shadow-sm border border-red-700 dark:border-red-500 flex flex-col items-center">
                                              <span className="text-[11px]">PORT {portInfo.port}</span>
                                              <span className="text-[9px] font-semibold opacity-90">{portInfo.service}</span>
                                              <span className="text-[8px] opacity-75">{portInfo.protocol}</span>
                                            </div>
                                          ))}
                                        </div>
                                        <p className="mt-2.5 text-[10px] text-red-600 dark:text-red-400 leading-relaxed font-medium">Critical network vulnerability detected. These ports are frequently targeted by automated scanning and exploitation tools. Immediate review suggested.</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {endpoints.length > 5 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
                <button
                  onClick={() => { window.location.href = "/endpoints"; }}
                  className="group inline-flex items-center gap-2 px-6 py-2 bg-white dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:text-slate-900 dark:hover:text-white transition-all duration-300 active:scale-95"
                >
                  View All {endpoints.length} Endpoints
                  <svg className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 dark:group-hover:text-white transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 self-start transition-all">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Risk Intelligence</h2>
            {showNewStatus && (
              <span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-[10px] font-black uppercase tracking-widest animate-pulse border border-primary-200 dark:border-primary-800">
                (new)
              </span>
            )}
          </div>
          {loadingInterpretation && (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4"></div>
              <div className="h-20 bg-slate-50 dark:bg-slate-900 rounded-xl"></div>
              <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          )}
          {!loadingInterpretation && !interpretation && (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic py-4">
              Intelligence engine awaiting more scan data.
            </p>
          )}
          {!loadingInterpretation && interpretation && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter mb-0.5">Global Analysis Version</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatDateTimeIST(interpretation.generated_at)}</p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Posture Grade</p>
                <p className={`text-lg font-black leading-tight ${(interpretation?.interpretation?.organization_overview?.overall_security_health === "CRITICAL" || interpretation?.interpretation?.organization_overview?.overall_security_health === "UNSTABLE")
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-900 dark:text-white"
                  }`}>
                  {interpretation?.interpretation?.organization_overview?.overall_security_health || "STABLE"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Key Insights</p>
                {(interpretation?.interpretation?.key_observations || [])
                  .slice(0, 3)
                  .map((obs, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-indigo-500 font-black">•</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{obs}</p>
                    </div>
                  ))}
              </div>

              <button
                className="w-full mt-2 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 hover:shadow-xl active:scale-95 transition-all"
                onClick={() => { window.location.href = "/posture"; }}
              >
                Full Posture Analysis
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-all">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System interpretation</h2>
        </div>
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-2">
          <Interpretation />
        </div>
      </div>
    </div>
  );
}
