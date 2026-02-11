import { useEffect, useState } from "react";
import { getLatestInterpretation } from "../api/api";
import { formatDateTimeIST } from "../utils/dateUtils";

export default function Posture() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestInterpretation()
      .then((res) => {
        setData(res.status === "empty" ? null : res);
      })
      .finally(() => setLoading(false));
  }, []);

  const interp = data?.interpretation;
  const overview = interp?.organization_overview ?? interp;
  const keyObservations = interp?.key_observations || [];
  const contextNotes = interp?.context_notes || [];

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <h1 className="text-2xl font-semibold mb-6 text-slate-900 dark:text-slate-100">
        Organizational Security Posture
      </h1>

      {loading && (
        <p className="text-slate-500 dark:text-slate-400 animate-pulse">
          Loading posture interpretation...
        </p>
      )}

      {!loading && !data && (
        <p className="text-slate-500 dark:text-slate-400">
          No posture data available yet. Run Systemic Analysis from the Dashboard to generate.
        </p>
      )}

      {!loading && data && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-300 p-5">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Overview</h2>
              <span className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200">
                {formatDateTimeIST(data.generated_at)}
              </span>
            </div>

            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
              <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Security Posture Grade</p>
              <p className={`text-2xl font-black ${(overview?.overall_security_health === "CRITICAL" || overview?.overall_security_health === "UNSTABLE")
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-900 dark:text-white"
                }`}>
                {overview?.overall_security_health || "STABLE"}
              </p>
            </div>

            <p className="text-slate-700 dark:text-slate-300">
              <strong>Hosts analyzed:</strong>{" "}
              {overview?.total_hosts_analyzed ?? "N/A"}
            </p>

            <p className="text-slate-700 dark:text-slate-300 mt-1">
              <strong>Scope:</strong>{" "}
              {overview?.analysis_scope ?? "N/A"}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-300 p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">
              Key Observations
            </h2>

            {keyObservations.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No observations available.
              </p>
            )}

            {keyObservations.length > 0 && (
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300">
                {keyObservations.map((obs, idx) => (
                  <li key={idx}>{typeof obs === "string" ? obs : JSON.stringify(obs)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-300 p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">
              Context & Limitations
            </h2>

            {contextNotes.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No context notes available.
              </p>
            )}

            {contextNotes.length > 0 && (
              <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400 text-sm">
                {contextNotes.map((note, idx) => (
                  <li key={idx}>{typeof note === "string" ? note : JSON.stringify(note)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
