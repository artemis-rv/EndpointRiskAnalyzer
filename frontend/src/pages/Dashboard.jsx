import { useEffect, useState } from "react";
import {
  getEndpoints,
  triggerAnalysis,
  getLatestPosture,
} from "../api/api";

import Interpretation from "../components/Interpretation";
import EndpointScans from "../components/EndpointScans";

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

async function scheduleScanAll() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/jobs/scan/all", {
      method: "POST",
    });
    const data = await res.json();
    alert(`Scheduled scans for ${data.jobs_created} endpoints`);
  } catch (err) {
    alert("Failed to schedule scan jobs");
  }
}

export default function Dashboard() {
  const [endpoints, setEndpoints] = useState([]);
  const [posture, setPosture] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);

  useEffect(() => {
    getEndpoints().then((data) => setEndpoints(data.endpoints || []));
    getLatestPosture().then(setPosture);
  }, []);

  const totalEndpoints = endpoints.length;
  const activeAgents = endpoints.filter(
    (ep) => ep.agent_active || ep.agent_status === "active"
  ).length;
  const lastScan =
    posture?.latest_scan_at ||
    posture?.last_scan_at ||
    posture?.generated_at ||
    posture?.created_at;

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
          <button
            onClick={scheduleScanAll}
            className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-medium border border-slate-200 hover:border-slate-300"
          >
            Schedule Scan (All Endpoints)
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
            {formatDateTime(lastScan)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold">Endpoints</h2>
            <p className="text-sm text-gray-500">
              Click an endpoint to view scan history.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {endpoints.length === 0 && (
              <div className="p-4 text-sm text-gray-500">
                No endpoints found.
              </div>
            )}
            {endpoints.map((ep) => (
              <div
                key={ep.endpoint_id}
                className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {ep.hostname || "Unnamed Endpoint"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {ep.os || "Unknown OS"} - Scans: {ep.scan_count ?? 0}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEndpoint(ep.endpoint_id)}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800"
                >
                  View Scans
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Latest Posture</h2>
          <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-auto max-h-96">
            {posture ? JSON.stringify(posture, null, 2) : "No posture yet"}
          </pre>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Interpretation</h2>
        <Interpretation />
      </div>

      {selectedEndpoint && (
        <EndpointScans
          endpointId={selectedEndpoint}
          onClose={() => setSelectedEndpoint(null)}
        />
      )}
    </div>
  );
}
