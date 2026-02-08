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

  const totalEndpoints = endpoints.length;
  const activeAgents = endpoints.filter(
    (ep) => ep.agent_active === true
  ).length;

  const lastScan =
    posture?.generated_at ||
    posture?.latest_scan_at ||
    posture?.last_scan_at ||
    posture?.created_at ||
    interpretation?.generated_at;

  const toggleEndpointScans = (endpointId) => {
    if (selectedEndpoint === endpointId) {
      setSelectedEndpoint(null);
    } else {
      setSelectedEndpoint(endpointId);
      if (!scans[endpointId]) {
        setLoadingScans({ ...loadingScans, [endpointId]: true });
        getScans(endpointId)
          .then((data) => {
            setScans({ ...scans, [endpointId]: data.scans || [] });
          })
          .finally(() => {
            setLoadingScans({ ...loadingScans, [endpointId]: false });
          });
      }
    }
  };

  const toggleScanDetail = (endpointId, scanIdx) => {
    const key = `${endpointId}-${scanIdx}`;
    setExpandedScan({
      ...expandedScan,
      [key]: !expandedScan[key],
    });
  };

  const getRiskColor = (riskLevel) => {
    const level = riskLevel?.toLowerCase() || "";
    if (level.includes("critical") || level.includes("high"))
      return "bg-red-100 text-red-800 border-red-200";
    if (level.includes("medium") || level.includes("moderate"))
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (level.includes("low"))
      return "bg-green-100 text-green-800 border-green-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Org security posture, endpoint activity, and latest scans.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerAnalysis}
            className="group px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
          >
            <span>Run Systemic Analysis</span>
            <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Endpoints</p>
          <p className="text-4xl font-black text-slate-900">{totalEndpoints}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Agents</p>
          <p className="text-4xl font-black text-slate-900">
            {activeAgents || activeAgents === 0 ? activeAgents : "N/A"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Last Scan</p>
          <p className="text-xl font-bold text-slate-800">
            {formatDateTimeIST(lastScan)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Endpoints</h2>
              <p className="text-xs text-slate-500">
                Displaying top 5 active endpoints.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {endpoints.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic">
                No endpoints found. Make sure agents are registered.
              </div>
            )}
            {endpoints.slice(0, 5).map((ep) => (
              <div key={ep.endpoint_id}>
                {/* Endpoint Row */}
                <div className="p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50 transition-colors">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {ep.hostname || "Unnamed Endpoint"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {ep.os || "Unknown OS"} • Scans: {ep.scan_count ?? 0}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleEndpointScans(ep.endpoint_id)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${selectedEndpoint === ep.endpoint_id
                      ? "bg-slate-100 text-slate-900 border border-slate-200"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                  >
                    {selectedEndpoint === ep.endpoint_id ? "Hide Details" : "Scan History"}
                  </button>
                </div>

                {/* Scan History Dropdown */}
                {selectedEndpoint === ep.endpoint_id && (
                  <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                    <div className="pt-4">
                      {loadingScans[ep.endpoint_id] && (
                        <div className="flex items-center gap-3 text-slate-400 animate-pulse">
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                          <span className="text-xs font-medium">Fetching history...</span>
                        </div>
                      )}

                      {!loadingScans[ep.endpoint_id] && scans[ep.endpoint_id]?.length === 0 && (
                        <p className="text-xs text-slate-400 italic py-2">
                          No scan logs recorded for this endpoint.
                        </p>
                      )}

                      {!loadingScans[ep.endpoint_id] && scans[ep.endpoint_id]?.length > 0 && (
                        <div className="space-y-3">
                          {scans[ep.endpoint_id].map((scan, idx) => {
                            const scanKey = `${ep.endpoint_id}-${idx}`;
                            const isExpanded = expandedScan[scanKey];
                            const riskLevel = scan.scan_data?.risk_assessment?.risk_level || "N/A";
                            const riskFlags = scan.scan_data?.risk_assessment?.risk_flags || [];
                            const openPorts = scan.scan_data?.exposure_posture?.open_ports || [];

                            return (
                              <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition-colors">
                                <button
                                  onClick={() => toggleScanDetail(ep.endpoint_id, idx)}
                                  className="w-full p-4 flex items-center justify-between text-left transition-colors"
                                >
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs font-bold text-slate-700">
                                      {formatDateTimeIST(scan.scan_time)}
                                    </span>
                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-tight ${getRiskColor(riskLevel)}`}>
                                      {riskLevel}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
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
                                  <div className="p-4 pt-0 border-t border-slate-100 bg-white">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                      {/* Issues/Flags */}
                                      <div>
                                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-2">Findings</h5>
                                        {riskFlags.length === 0 ? (
                                          <p className="text-xs text-slate-400 italic">No anomalies detected.</p>
                                        ) : (
                                          <ul className="space-y-1.5">
                                            {riskFlags.map((flag, flagIdx) => (
                                              <li key={flagIdx} className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-red-500 font-bold shrink-0">!</span>
                                                <span className="text-[11px] text-slate-700 leading-tight">{flag}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>

                                      {/* Risk Breakdown Section */}
                                      <div>
                                        <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-2">Internal Breakdown</h5>
                                        <div className="space-y-1.5">
                                          {scan.scan_data?.risk_assessment?.breakdown?.map((item, bIdx) => (
                                            <div key={bIdx} className="flex justify-between items-center text-[10px] p-2 bg-slate-50/50 rounded border border-slate-100">
                                              <span className="text-slate-600 font-medium">{item[0]}</span>
                                              <span className="text-red-600 font-black">+{item[1]} pts</span>
                                            </div>
                                          ))}
                                          <div className="flex justify-between items-center bg-slate-900 text-white p-2.5 rounded-lg shadow-md mt-4">
                                            <span className="text-[10px] font-black uppercase tracking-tight">Consolidated Risk Score</span>
                                            <span className="text-sm font-black">{scan.scan_data.risk_assessment.risk_score}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Risky Ports Check */}
                                    {openPorts.some(p => [21, 23, 25, 110, 135, 139, 445, 3389].includes(parseInt(p)) || [21, 23, 25, 110, 135, 139, 445, 3389].includes(p)) && (
                                      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-inner-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                          <span className="text-lg">⚠️</span>
                                          <span className="text-[11px] font-black text-red-700 uppercase tracking-widest">Risky Port Exposure Detected</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {openPorts.filter(p => [21, 23, 25, 110, 135, 139, 445, 3389].includes(parseInt(p)) || [21, 23, 25, 110, 135, 139, 445, 3389].includes(p)).map((p, pIdx) => (
                                            <span key={pIdx} className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded shadow-sm border border-red-700">
                                              PORT {p}
                                            </span>
                                          ))}
                                        </div>
                                        <p className="mt-2.5 text-[10px] text-red-600 leading-relaxed font-medium">Critical network vulnerability detected. These ports are frequently targeted by automated scanning and exploitation tools. Immediate review suggested.</p>
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
              <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50/50 rounded-b-2xl">
                <button
                  onClick={() => { window.location.href = "/endpoints"; }}
                  className="group inline-flex items-center gap-2 px-6 py-2 bg-white text-xs font-black text-slate-700 uppercase tracking-widest rounded-full border border-slate-200 shadow-sm hover:shadow-md hover:text-slate-900 transition-all duration-300 active:scale-95"
                >
                  View All {endpoints.length} Endpoints
                  <svg className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 self-start">
          <h2 className="text-xl font-black text-slate-900 tracking-tight mb-4">Risk Intelligence</h2>
          {loadingInterpretation && (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4"></div>
              <div className="h-20 bg-slate-50 rounded-xl"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
            </div>
          )}
          {!loadingInterpretation && !interpretation && (
            <p className="text-sm text-slate-500 italic py-4">
              Intelligence engine awaiting more scan data.
            </p>
          )}
          {!loadingInterpretation && interpretation && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Global Analysis Version</p>
                <p className="text-xs font-bold text-slate-700">{formatDateTimeIST(interpretation.generated_at)}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-2">Posture Grade</p>
                <p className="text-lg font-black text-slate-900 leading-tight">
                  {interpretation?.interpretation?.organization_overview?.overall_security_health || "STABLE"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key Insights</p>
                {(interpretation?.interpretation?.key_observations || [])
                  .slice(0, 3)
                  .map((obs, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-primary-500 font-black">•</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{obs}</p>
                    </div>
                  ))}
              </div>

              <button
                className="w-full mt-2 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 hover:shadow-xl active:scale-95 transition-all"
                onClick={() => { window.location.href = "/posture"; }}
              >
                Full Posture Analysis
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-8 bg-slate-900 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">System interpretation</h2>
        </div>
        <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-2">
          <Interpretation />
        </div>
      </div>
    </div>
  );
}
