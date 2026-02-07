import { useEffect, useState } from "react";
import { getLatestInterpretation } from "../api/api";

export default function Interpretation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestInterpretation()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500 animate-pulse">Loading interpretation...</p>;
  }

  if (!data || data.status === "empty") {
    return (
      <p className="text-sm text-gray-500">
        No interpretation available yet. Run &quot;Run Systemic Analysis&quot; to generate posture and interpretation.
      </p>
    );
  }

  const interp = data.interpretation;
  const overview = interp?.organization_overview || interp;
  const totalHosts = overview?.total_hosts_analyzed ?? overview?.total_hosts ?? "N/A";
  const scope = overview?.analysis_scope ?? "N/A";
  const observations = interp?.key_observations || [];
  const contextNotes = interp?.context_notes || [];

  return (
    <div className="space-y-4 text-sm text-gray-700">
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">Overview</h3>
        <p><strong>Total Hosts Analyzed:</strong> {totalHosts}</p>
        <p><strong>Analysis Scope:</strong> {scope}</p>
      </div>

      {observations.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Key Observations</h3>
          <ul className="list-disc list-inside">
            {observations.map((obs, idx) => (
              <li key={idx}>{typeof obs === "string" ? obs : JSON.stringify(obs)}</li>
            ))}
          </ul>
        </div>
      )}

      {contextNotes.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Context &amp; Limitations</h3>
          <ul className="list-disc list-inside">
            {contextNotes.map((note, idx) => (
              <li key={idx}>{typeof note === "string" ? note : JSON.stringify(note)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
