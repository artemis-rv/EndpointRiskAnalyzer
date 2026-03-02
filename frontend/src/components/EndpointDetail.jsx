import { useEffect, useState } from "react";
import { formatDateTimeIST } from "../utils/dateUtils";
import { getRiskScore } from "../api/api";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

export default function EndpointDetail({ endpoint }) {
  const [riskData, setRiskData] = useState(null);
  const [endpointDetails, setEndpointDetails] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isRemediationExpanded, setIsRemediationExpanded] = useState(false);

  useEffect(() => {
    if (endpoint?.endpoint_id) {
      setLoadingRisk(true);
      getRiskScore(endpoint.endpoint_id)
        .then((data) => {
          setRiskData(data);
          setLoadingRisk(false);
        })
        .catch((err) => {
          console.error("Failed to fetch risk score", err);
          setLoadingRisk(false);
        });

      setLoadingDetails(true);
      const baseUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      fetch(`${baseUrl}/api/endpoints/${endpoint.endpoint_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            setEndpointDetails(data);
          }
          setLoadingDetails(false);
        })
        .catch(err => {
          console.error("Failed to fetch endpoint details", err);
          setLoadingDetails(false);
        })
    }
  }, [endpoint]);

  if (!endpoint) return null;

  // Extract failed controls that have remediation data
  const failedControls = endpointDetails?.latest_scan?.data?.cis_compliance?.controls?.filter(
    c => c.status?.toLowerCase().includes("non") && c.remediation
  ) || [];

  // Sort by priority (Critical -> High -> Medium) if applicable (Dummy sort here, can be refined based on score)
  // Since we don't have explicit control severity in the JSON schema easily, 
  // we'll just sort them alphabetically by control_id for consistency.
  failedControls.sort((a, b) => a.control_id.localeCompare(b.control_id, undefined, { numeric: true }));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-950/20 border border-slate-200 dark:border-slate-700 p-6 transition-all">
      <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest">Endpoint Details</h3>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Hostname</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{endpoint.hostname}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">OS</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{endpoint.os}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Last Seen</p>
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{formatDateTimeIST(endpoint.last_seen)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Scans</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{endpoint.scan_count || 0}</p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">ML Risk Assessment</p>

          {loadingRisk ? (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs animate-pulse">
              <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 dark:border-slate-600 dark:border-t-slate-400 rounded-full animate-spin"></div>
              Analyzing patterns...
            </div>
          ) : riskData ? (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tight ${riskData.risk === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  riskData.risk === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    riskData.risk === 'Low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                  {riskData.risk} Risk
                </span>

                {riskData.is_anomaly && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-500 rounded text-[10px] font-black uppercase tracking-tight animate-pulse border border-red-500/20">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Anomaly
                  </div>
                )}
              </div>

              <div className="flex items-end justify-between">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                  Score: <span className="font-mono text-slate-900 dark:text-slate-200">{riskData.anomaly_score?.toFixed(4)}</span>
                </div>
              </div>

              {riskData.details && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 leading-relaxed">
                  {riskData.details}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 italic p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
              No ML assessment generated for this endpoint yet.
            </div>
          )}
        </div>

        {/* Remediation Strategies Section */}
        {failedControls.length > 0 && (
          <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setIsRemediationExpanded(!isRemediationExpanded)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Remediation Strategies</p>
                <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-[9px] font-bold">
                  {failedControls.length} Fails
                </span>
              </div>
              {isRemediationExpanded ? (
                <ChevronUpIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              )}
            </button>

            {isRemediationExpanded && (
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {failedControls.map((control) => (
                  <div key={control.control_id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                    <div className="flex flex-col gap-2 pl-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          CIS {control.control_id}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-500">
                          Action Required
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {control.remediation.description}
                      </h4>

                      <div className="mt-1 space-y-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Why it matters</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {control.remediation.why_it_matters}
                          </p>
                        </div>
                        <div className="bg-slate-900 dark:bg-black/50 p-2.5 rounded-lg border border-slate-700 font-mono text-xs text-green-400 select-all overflow-x-auto whitespace-pre-wrap">
                          {control.remediation.manual_fix_command}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Expected State: <span className="font-bold">{control.remediation.expected_secure_state}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
