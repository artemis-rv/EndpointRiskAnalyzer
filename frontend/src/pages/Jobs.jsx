import { useEffect, useState } from "react";
import { getJobs } from "../api/api";
import { formatDateTimeIST } from "../utils/dateUtils";
import { TableSkeleton } from "../components/LoadingSkeleton";

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
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <h1 className="text-2xl font-semibold mb-6 text-slate-900 dark:text-slate-100">Jobs</h1>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-300 p-4">
        {loading && (
          <p className="text-slate-500 dark:text-slate-400 animate-pulse">
            Loading jobs...
          </p>
        )}

        {!loading && jobs.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">
            No jobs scheduled yet.
          </p>
        )}

        {!loading && jobs.length > 0 && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 pr-4 font-medium">Job ID</th>
                  <th className="py-2 pr-4 font-medium">Endpoint</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {jobs.map((job) => (
                  <tr key={job.job_id || job._id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-900 dark:text-slate-100">
                      {job.job_id ? `${String(job.job_id).slice(0, 8)}...` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{job.endpoint_id ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{job.job_type ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          job.status === "completed"
                            ? "inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs text-green-800 dark:text-green-200"
                            : "inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300"
                        }
                      >
                        {job.status ?? "pending"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-sm text-slate-500 dark:text-slate-400">
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
