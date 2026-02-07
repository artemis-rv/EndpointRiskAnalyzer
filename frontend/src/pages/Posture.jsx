import { useEffect, useState } from "react";
import { getLatestPostureInterpretation } from "../api/api";

export default function Posture() {
  const [posture, setPosture] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLatestPostureInterpretation()
      .then((data) => {
        setPosture(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const overview = posture?.interpretation?.organization_overview;
  const keyObservations = posture?.interpretation?.key_observations || [];
  const contextNotes = posture?.interpretation?.context_notes || [];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">
        Organizational Security Posture
      </h1>

      {loading && (
        <p className="text-gray-500 animate-pulse">
          Generating posture interpretation...
        </p>
      )}

      {!loading && !posture && (
        <p className="text-gray-500">
          No posture data available yet.
        </p>
      )}

      {!loading && posture && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold">Overview</h2>
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-800">
                {posture?.generated_at
                  ? new Date(posture.generated_at).toLocaleString()
                  : "N/A"}
              </span>
            </div>

            <p className="text-gray-700">
              <strong>Hosts analyzed:</strong>{" "}
              {overview?.total_hosts_analyzed ?? "N/A"}
            </p>

            <p className="text-gray-700 mt-1">
              <strong>Scope:</strong>{" "}
              {overview?.analysis_scope ?? "N/A"}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold mb-3">
              Key Observations
            </h2>

            {keyObservations.length === 0 && (
              <p className="text-gray-500 text-sm">
                No observations available.
              </p>
            )}

            {keyObservations.length > 0 && (
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                {keyObservations.map((obs, idx) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-100 rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold mb-3">
              Context & Limitations
            </h2>

            {contextNotes.length === 0 && (
              <p className="text-gray-500 text-sm">
                No context notes available.
              </p>
            )}

            {contextNotes.length > 0 && (
              <ul className="list-disc list-inside space-y-2 text-gray-600 text-sm">
                {contextNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
