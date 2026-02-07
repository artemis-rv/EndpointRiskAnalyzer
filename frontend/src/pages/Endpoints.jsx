import { useEffect, useState } from "react";
import { getEndpoints } from "../api/api";
import EndpointDetail from "../components/EndpointDetail";
import { formatDateTimeIST } from "../utils/dateUtils";

export default function Endpoints() {
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);

  useEffect(() => {
    getEndpoints().then((data) => setEndpoints(data.endpoints || []));
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Endpoints</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Table: centered card */}
        <div className="flex-1 bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left py-4 px-6 font-semibold">Hostname</th>
                  <th className="text-left py-4 px-6 font-semibold">OS</th>
                  <th className="text-left py-4 px-6 font-semibold">Scans</th>
                  <th className="text-left py-4 px-6 font-semibold">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {endpoints.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                      No endpoints found.
                    </td>
                  </tr>
                )}
                {endpoints.map((ep) => (
                  <tr
                    key={ep.endpoint_id}
                    onClick={() => setSelectedEndpoint(ep)}
                    className={`cursor-pointer transition-colors ${
                      selectedEndpoint?.endpoint_id === ep.endpoint_id
                        ? "bg-indigo-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-4 px-6 text-slate-900 font-medium">
                      {ep.hostname || "—"}
                    </td>
                    <td className="py-4 px-6 text-slate-600">{ep.os ?? "—"}</td>
                    <td className="py-4 px-6 text-slate-600">{ep.scan_count ?? 0}</td>
                    <td className="py-4 px-6 text-slate-600 text-sm">
                      {formatDateTimeIST(ep.last_seen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail pane */}
        <div className="w-full lg:w-96 flex-shrink-0">
          {selectedEndpoint ? (
            <EndpointDetail endpoint={selectedEndpoint} />
          ) : (
            <div className="bg-white rounded-xl shadow p-6 text-slate-500 text-sm">
              Select an endpoint to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
