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
                  <th className="py-2 pr-4 font-black uppercase tracking-widest text-[10px]">Job ID</th>
                  <th className="py-2 pr-4 font-black uppercase tracking-widest text-[10px]">Endpoint HostName</th>
                  <th className="py-2 pr-4 font-black uppercase tracking-widest text-[10px]">ID</th>
                  <th className="py-2 pr-4 font-black uppercase tracking-widest text-[10px]">Type</th>
                  <th className="py-2 pr-4 font-black uppercase tracking-widest text-[10px]">Status</th>
                  <th className="py-2 pr-4 font-black uppercase tracking-widest text-[10px]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {jobs.map((job) => (
                  <tr key={job.job_id || job._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150 group">
                    <td className="py-3 pr-4 font-mono text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {job.job_id ? `${String(job.job_id).slice(0, 8)}...` : "—"}
                    </td>
                    <td className="py-3 pr-4 text-slate-900 dark:text-white font-bold">{job.hostname ?? "—"}</td>
                    <td className="py-3 pr-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium">{job.endpoint_id ? `${String(job.endpoint_id).slice(0, 8)}...` : "—"}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                        {job.job_type ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {job.status === "pending" && !job.agent_active ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400"></span>
                          Disconnected
                        </span>
                      ) : (
                        <span
                          className={
                            job.status === "completed"
                              ? "inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 shadow-sm"
                              : "inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-tight text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 animate-pulse"
                          }
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${job.status === "completed" ? "bg-green-500" : "bg-indigo-500"}`}></span>
                          {job.status ?? "pending"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[10px] text-slate-500 dark:text-slate-500 font-medium">
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
