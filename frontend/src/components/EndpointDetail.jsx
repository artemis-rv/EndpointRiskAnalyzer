import { useState, useEffect } from "react";
import { getScans } from "../api/api";
import { formatDateTimeIST } from "../utils/dateUtils";

export default function EndpointDetail({ endpoint }) {
  const [showScans, setShowScans] = useState(false);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedScan, setExpandedScan] = useState(null);

  const loadScans = () => {
    if (!endpoint?.endpoint_id) return;

    setLoading(true);
    getScans(endpoint.endpoint_id)
      .then((data) => {
        setScans(data.scans || []);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleViewScans = () => {
    if (!showScans) {
      loadScans();
    }
    setShowScans(!showScans);
  };

  const toggleScanDetail = (idx) => {
    setExpandedScan(expandedScan === idx ? null : idx);
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-950/20 border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Endpoint Details</h3>
      </div>

      {/* Details */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Hostname</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{endpoint.hostname || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">OS</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{endpoint.os || "—"}</p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Last Seen</p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {formatDateTimeIST(endpoint.last_seen)}
          </p>
        </div>

        {/* View Scans Button */}
        <div className="pt-2">
          <button
            onClick={handleViewScans}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm ${showScans
              ? "bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-white border border-slate-200 dark:border-slate-600"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none"
              }`}
          >
            {showScans ? "Hide Assessment" : "View Scan Findings"}
          </button>
        </div>
      </div>

      {/* Scans Section */}
      {showScans && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Recent Findings</h4>
            {loading && (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
            )}
          </div>

          {!loading && scans.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">No scan records found for this endpoint.</p>
          )}

          {!loading && scans.length > 0 && (
            <div className="space-y-3">
              {scans.slice(0, 3).map((scan, idx) => {
                const isExpanded = expandedScan === idx;
                const riskLevel = scan.scan_data?.risk_assessment?.risk_level || "N/A";
                const riskFlags = scan.scan_data?.risk_assessment?.risk_flags || [];
                const openPorts = scan.scan_data?.exposure_posture?.open_ports || [];

                return (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm transition-colors"
                  >
                    <button
                      onClick={() => toggleScanDetail(idx)}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">
                          {formatDateTimeIST(scan.scan_time)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-tight ${getRiskColor(
                            riskLevel
                          )}`}
                        >
                          {riskLevel}
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                        {/* Risk Flags Section */}
                        <div>
                          <h5 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Finding Flags</h5>
                          {riskFlags.length === 0 ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-500 italic">No anomalies detected.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {riskFlags.map((flag, flagIdx) => (
                                <li key={flagIdx} className="flex items-start gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-xs">
                                  <span className="text-red-500 font-bold shrink-0">!</span>
                                  <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight font-medium">{flag}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Open Ports Section */}
                        <div>
                          <h5 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Network Exposure</h5>
                          {openPorts.length === 0 ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-500 italic">No active listeners found.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {openPorts.map((port, portIdx) => (
                                <span
                                  key={portIdx}
                                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-md border border-indigo-100 dark:border-indigo-800"
                                >
                                  PORT {port}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
