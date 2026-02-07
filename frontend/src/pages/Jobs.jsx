import { useEffect, useState } from "react";
import { getJobs } from "../api/api";
import { formatDateTimeIST } from "../utils/dateUtils";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = () =>
    getJobs()
      .then((data) => setJobs(Array.isArray(data.jobs) ? data.jobs : []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">Jobs</h1>

      <div className="bg-white rounded-xl shadow p-4">
        {loading && (
          <p className="text-gray-500 animate-pulse">
            Loading jobs...
          </p>
        )}

        {!loading && jobs.length === 0 && (
          <p className="text-gray-500">
            No jobs scheduled yet.
          </p>
        )}

        {!loading && jobs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="py-2 pr-4 font-medium">Job ID</th>
                  <th className="py-2 pr-4 font-medium">Endpoint</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.job_id || job._id} className="hover:bg-slate-100">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {job.job_id ? `${String(job.job_id).slice(0, 8)}...` : "—"}
                    </td>
                    <td className="py-2 pr-4">{job.endpoint_id ?? "—"}</td>
                    <td className="py-2 pr-4">{job.job_type ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          job.status === "completed"
                            ? "inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-800"
                            : "inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700"
                        }
                      >
                        {job.status ?? "pending"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-sm text-gray-500">
                      {formatDateTimeIST(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
