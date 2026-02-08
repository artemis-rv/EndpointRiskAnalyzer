import React, { useEffect, useState } from "react";
import { getEndpoints, getScans } from "../api/api";
import EndpointDetail from "../components/EndpointDetail";
import { formatDateTimeIST } from "../utils/dateUtils";

export default function Endpoints() {
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [expandedRisk, setExpandedRisk] = useState({});
  const [scans, setScans] = useState({});
  const [loadingScans, setLoadingScans] = useState({});

  useEffect(() => {
    getEndpoints().then((data) => setEndpoints(data.endpoints || []));
  }, []);

  const toggleRiskBreakdown = (endpointId, e) => {
    e.stopPropagation();
    setExpandedRisk({ ...expandedRisk, [endpointId]: !expandedRisk[endpointId] });
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
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">Endpoints</h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Table Container */}
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-widest">Hostname</th>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-widest">Status</th>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-widest">OS</th>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-widest">Scans</th>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-widest">Risk Analysis</th>
                    <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-widest">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {endpoints.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 italic">
                        No endpoints registered in the system.
                      </td>
                    </tr>
                  )}
                  {endpoints.map((ep) => (
                    <React.Fragment key={ep.endpoint_id}>
                      <tr
                        onClick={() => setSelectedEndpoint(ep)}
                        className={`group cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${selectedEndpoint?.endpoint_id === ep.endpoint_id
                          ? "bg-primary-50/50 dark:bg-primary-900/10"
                          : ""
                          }`}
                      >
                        <td className="py-4 px-6 text-slate-900 dark:text-white font-bold">
                          {ep.hostname || "—"}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${ep.agent_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-600"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ep.agent_active ? "bg-green-500" : "bg-slate-400"}`}></span>
                            {ep.agent_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-400 text-sm font-medium">{ep.os ?? "—"}</td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-bold">{ep.scan_count ?? 0}</td>
                        <td className="py-4 px-6">
                          <button
                            onClick={(e) => toggleRiskBreakdown(ep.endpoint_id, e)}
                            className="bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-sm"
                          >
                            {expandedRisk[ep.endpoint_id] ? "Hide Risk" : "View Risk"}
                          </button>
                        </td>
                        <td className="py-4 px-6 text-slate-500 dark:text-slate-500 text-xs font-medium">
                          {formatDateTimeIST(ep.last_seen)}
                        </td>
                      </tr>
                      {expandedRisk[ep.endpoint_id] && (
                        <tr className="bg-slate-50 dark:bg-slate-900/30">
                          <td colSpan={6} className="px-6 py-4">
                            {loadingScans[ep.endpoint_id] ? (
                              <div className="flex items-center gap-2 text-slate-400 text-xs animate-pulse">
                                <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                                Loading risk breakdown...
                              </div>
                            ) : scans[ep.endpoint_id]?.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Detailed Findings</h4>
                                  <div className="space-y-1">
                                    {(scans[ep.endpoint_id][0].scan_data?.risk_assessment?.risk_flags || []).map((flag, fi) => (
                                      <div key={fi} className="text-[10px] flex items-start gap-2 text-slate-700 dark:text-slate-300">
                                        <span className="text-red-500">!</span> {flag}
                                      </div>
                                    ))}
                                    {(!scans[ep.endpoint_id][0].scan_data?.risk_assessment?.risk_flags?.length) && <p className="text-[10px] text-slate-400 italic">No anomalies detected.</p>}
                                  </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Score Breakdown</h4>
                                  <div className="flex items-center justify-between">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${getRiskColor(scans[ep.endpoint_id][0].scan_data?.risk_assessment?.risk_level)}`}>
                                      {scans[ep.endpoint_id][0].scan_data?.risk_assessment?.risk_level || "STABLE"}
                                    </span>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">
                                      {scans[ep.endpoint_id][0].scan_data?.risk_assessment?.risk_score} <span className="text-[10px] font-bold text-slate-400 uppercase">pts</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Scan data missing for risk breakdown.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Pane */}
          <div className="w-full lg:w-96 flex-shrink-0">
            {selectedEndpoint ? (
              <EndpointDetail endpoint={selectedEndpoint} />
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center transition-all">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Endpoint Details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Select an endpoint from the table to view configuration, network posture, and recent scan results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
