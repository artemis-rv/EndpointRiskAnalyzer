
import { useEffect, useState } from "react";
import { formatDateTimeIST } from "../utils/dateUtils";
import { getRiskScore } from "../api/api";

export default function EndpointDetail({ endpoint }) {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (endpoint?.endpoint_id) {
      setLoading(true);
      getRiskScore(endpoint.endpoint_id)
        .then((data) => {
          setRiskData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch risk score", err);
          setLoading(false);
        });
    }
  }, [endpoint]);

  if (!endpoint) return null;

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

          {loading ? (
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
      </div>
    </div>
  );
}
