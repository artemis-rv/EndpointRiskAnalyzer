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
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4">
        <h3 className="text-lg font-semibold">Endpoint Details</h3>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Hostname</p>
          <p className="text-sm font-medium text-slate-900">{endpoint.hostname || "—"}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Operating System</p>
          <p className="text-sm font-medium text-slate-900">{endpoint.os || "—"}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Endpoint ID</p>
          <p className="text-sm font-mono text-slate-700 break-all">{endpoint.endpoint_id || "—"}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Last Seen</p>
          <p className="text-sm font-medium text-slate-900">
            {formatDateTimeIST(endpoint.last_seen)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Scans</p>
          <p className="text-sm font-medium text-slate-900">{endpoint.scan_count ?? 0}</p>
        </div>

        {/* View Scans Button */}
        <div className="pt-3 border-t border-slate-200">
          <button
            onClick={handleViewScans}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            {showScans ? "Hide Scans" : "View Scans"}
          </button>
        </div>
      </div>

      {/* Scans Section */}
      {showScans && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Scan History</h4>

          {loading && (
            <p className="text-sm text-gray-500 animate-pulse">Loading scans...</p>
          )}

          {!loading && scans.length === 0 && (
            <p className="text-sm text-gray-500">No scans available.</p>
          )}

          {!loading && scans.length > 0 && (
            <div className="space-y-2">
              {scans.map((scan, idx) => {
                const isExpanded = expandedScan === idx;
                const riskLevel = scan.scan_data?.risk_assessment?.risk_level || "N/A";
                const riskFlags = scan.scan_data?.risk_assessment?.risk_flags || [];
                const openPorts = scan.scan_data?.exposure_posture?.open_ports || [];

                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                  >
                    <button
                      onClick={() => toggleScanDetail(idx)}
                      className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex flex-col items-start gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          {formatDateTimeIST(scan.scan_time)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRiskColor(
                              riskLevel
                            )}`}
                          >
                            {riskLevel}
                          </span>
                          <span className="text-xs text-gray-500">
                            {openPorts.length} port{openPorts.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-slate-50">
                        <div className="space-y-4">
                          {/* Risk Flags Section */}
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900 mb-2">
                              Risk Flags
                            </h5>
                            {riskFlags.length === 0 ? (
                              <p className="text-xs text-gray-500">No risk flags detected</p>
                            ) : (
                              <ul className="space-y-1">
                                {riskFlags.map((flag, flagIdx) => (
                                  <li key={flagIdx} className="flex items-start gap-2">
                                    <span className="text-red-500 mt-0.5">⚠</span>
                                    <span className="text-xs text-slate-700">{flag}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Open Ports Section */}
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900 mb-2">
                              Open Ports
                            </h5>
                            {openPorts.length === 0 ? (
                              <p className="text-xs text-gray-500">No open ports detected</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {openPorts.map((port, portIdx) => (
                                  <span
                                    key={portIdx}
                                    className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-mono"
                                  >
                                    {port}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Risk Score */}
                          {scan.scan_data?.risk_assessment?.risk_score !== undefined && (
                            <div className="pt-3 border-t border-slate-200">
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Risk Score:</span>{" "}
                                {scan.scan_data.risk_assessment.risk_score}
                              </p>
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
