
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
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Endpoint Details</h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-500">Hostname</p>
          <p className="font-medium text-slate-900">{endpoint.hostname}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Operating System</p>
          <p className="font-medium text-slate-900">{endpoint.os}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Last Seen</p>
          <p className="font-medium text-slate-900">{formatDateTimeIST(endpoint.last_seen)}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Scan Count</p>
          <p className="font-medium text-slate-900">{endpoint.scan_count}</p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-2">ML Risk Assessment</p>
          {loading ? (
            <p className="text-sm text-slate-400">Analyzing...</p>
          ) : riskData ? (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${riskData.risk === 'High' ? 'bg-red-100 text-red-700' :
                    riskData.risk === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      riskData.risk === 'Low' ? 'bg-green-100 text-green-700' :
                        'bg-slate-200 text-slate-600'
                  }`}>
                  {riskData.risk}
                </span>
                {riskData.is_anomaly && (
                  <span className="text-xs font-semibold text-red-600 animate-pulse">
                    ANOMALY DETECTED
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Score: <span className="font-mono">{riskData.anomaly_score?.toFixed(4)}</span>
              </div>
              {riskData.details && (
                <div className="text-xs text-slate-400 mt-1 italic">
                  {riskData.details}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No assessment available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
