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
    const interval = setInterval(loadEndpoints, 15000); // poll every 15s so active agents count updates when agent starts/stops
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
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Org security posture, endpoint activity, and latest scans.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerAnalysis}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            Run Systemic Analysis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Total Endpoints</p>
          <p className="text-3xl font-bold">{totalEndpoints}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Active Agents</p>
          <p className="text-3xl font-bold">
            {activeAgents || activeAgents === 0 ? activeAgents : "N/A"}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500">Last Scan</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatDateTimeIST(lastScan)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold">Endpoints</h2>
            <p className="text-sm text-gray-500">
              Click "View Scans" to see scan history for each endpoint.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {endpoints.length === 0 && (
              <div className="p-4 text-sm text-gray-500">
                No endpoints found.
              </div>
            )}
            {endpoints.map((ep) => (
              <div key={ep.endpoint_id}>
                {/* Endpoint Row */}
                <div className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {ep.hostname || "Unnamed Endpoint"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {ep.os || "Unknown OS"} - Scans: {ep.scan_count ?? 0}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleEndpointScans(ep.endpoint_id)}
                    className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800"
                  >
                    {selectedEndpoint === ep.endpoint_id
                      ? "Hide Scans"
                      : "View Scans"}
                  </button>
                </div>

                {/* Scan History Dropdown */}
                {selectedEndpoint === ep.endpoint_id && (
                  <div className="px-4 pb-4 bg-slate-50">
                    <div className="border-t border-slate-200 pt-3">
                      <h4 className="text-sm font-semibold text-slate-900 mb-2">
                        Scan History
                      </h4>

                      {loadingScans[ep.endpoint_id] && (
                        <p className="text-sm text-gray-500 animate-pulse">
                          Loading scans...
                        </p>
                      )}

                      {!loadingScans[ep.endpoint_id] &&
                        (!scans[ep.endpoint_id] ||
                          scans[ep.endpoint_id].length === 0) && (
                          <p className="text-sm text-gray-500">
                            No scans available.
                          </p>
                        )}

                      {!loadingScans[ep.endpoint_id] &&
                        scans[ep.endpoint_id] &&
                        scans[ep.endpoint_id].length > 0 && (
                          <div className="space-y-2">
                            {scans[ep.endpoint_id].map((scan, idx) => {
                              const scanKey = `${ep.endpoint_id}-${idx}`;
                              const isExpanded = expandedScan[scanKey];
                              const riskLevel =
                                scan.scan_data?.risk_assessment?.risk_level ||
                                "N/A";
                              const riskFlags =
                                scan.scan_data?.risk_assessment?.risk_flags ||
                                [];
                              const openPorts =
                                scan.scan_data?.exposure_posture?.open_ports ||
                                [];

                              return (
                                <div
                                  key={idx}
                                  className="border border-slate-200 rounded-lg overflow-hidden bg-white"
                                >
                                  <button
                                    onClick={() =>
                                      toggleScanDetail(ep.endpoint_id, idx)
                                    }
                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="text-sm font-medium text-slate-700">
                                        {formatDateTimeIST(scan.scan_time)}
                                      </span>
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRiskColor(
                                          riskLevel
                                        )}`}
                                      >
                                        {riskLevel}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {openPorts.length} open port
                                        {openPorts.length !== 1 ? "s" : ""}
                                      </span>
                                    </div>
                                    <svg
                                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""
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
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Risk Flags Section */}
                                        <div>
                                          <h5 className="text-sm font-semibold text-slate-900 mb-2">
                                            Risk Flags
                                          </h5>
                                          {riskFlags.length === 0 ? (
                                            <p className="text-xs text-gray-500">
                                              No risk flags detected
                                            </p>
                                          ) : (
                                            <ul className="space-y-1">
                                              {riskFlags.map((flag, flagIdx) => (
                                                <li
                                                  key={flagIdx}
                                                  className="flex items-start gap-2"
                                                >
                                                  <span className="text-red-500 mt-0.5">
                                                    ⚠
                                                  </span>
                                                  <span className="text-xs text-slate-700">
                                                    {flag}
                                                  </span>
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
                                            <p className="text-xs text-gray-500">
                                              No open ports detected
                                            </p>
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
                                      </div>

                                      {/* Additional Details */}
                                      {scan.scan_data?.risk_assessment
                                        ?.risk_score !== undefined && (
                                          <div className="mt-3 pt-3 border-t border-slate-200">
                                            <p className="text-xs text-gray-600">
                                              <span className="font-medium">
                                                Risk Score:
                                              </span>{" "}
                                              {
                                                scan.scan_data.risk_assessment
                                                  .risk_score
                                              }
                                            </p>
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
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Latest Posture Summary</h2>
          {loadingInterpretation && (
            <p className="text-sm text-gray-500 animate-pulse">
              Loading...
            </p>
          )}
          {!loadingInterpretation && !interpretation && (
            <p className="text-sm text-gray-500">
              No posture interpretation available yet. Run Systemic Analysis to generate.
            </p>
          )}
          {!loadingInterpretation && interpretation && (
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong>Generated:</strong>{" "}
                {formatDateTimeIST(interpretation.generated_at)}
              </p>
              <p>
                <strong>Hosts analyzed:</strong>{" "}
                {interpretation?.interpretation?.organization_overview
                  ?.total_hosts_analyzed ?? "N/A"}
              </p>
              <ul className="list-disc list-inside mt-2">
                {(interpretation?.interpretation?.key_observations || [])
                  .slice(0, 3)
                  .map((obs, idx) => (
                    <li key={idx}>{obs}</li>
                  ))}
              </ul>
              <button
                className="mt-4 px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:border-slate-300"
                onClick={() => {
                  window.location.href = "/posture";
                }}
              >
                View Full Posture
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Interpretation</h2>
        <Interpretation />
      </div>
    </div>
  );
}
