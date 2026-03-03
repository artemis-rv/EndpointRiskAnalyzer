import React, { useMemo, useState } from "react";

/**
 * EndpointComparisonTable: Sortable, filterable table with inline compliance progress bar.
 * Shows endpoint details: hostname, OS, compliance score, control failures.
 */
const EndpointComparisonTable = React.memo(({ endpoints = [] }) => {
  const [sortKey, setSortKey] = useState("compliance_score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterRisk, setFilterRisk] = useState("all");

  const processedData = useMemo(() => {
    let filtered = endpoints;

    // Apply risk filter
    if (filterRisk !== "all") {
      filtered = filtered.filter((ep) => {
        const score = ep.compliance_score || 0;
        if (filterRisk === "hardened") return score >= 85;
        if (filterRisk === "moderate") return score >= 65 && score < 85;
        if (filterRisk === "atrisk") return score >= 45 && score < 65;
        if (filterRisk === "critical") return score < 45;
        return true;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal = a[sortKey] || 0;
      let bVal = b[sortKey] || 0;

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (sortOrder === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

    return sorted;
  }, [endpoints, sortKey, sortOrder, filterRisk]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const getRiskColor = (score) => {
    if (score >= 85) return "bg-green-500";
    if (score >= 65) return "bg-yellow-500";
    if (score >= 45) return "bg-orange-500";
    return "bg-red-500";
  };

  const getRiskLabel = (score) => {
    if (score >= 85) return "Hardened";
    if (score >= 65) return "Moderate";
    if (score >= 45) return "At Risk";
    return "Critical";
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
            Endpoint Comparison
          </h3>

          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="hardened">Hardened</option>
            <option value="moderate">Moderate</option>
            <option value="atrisk">At Risk</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort("hostname")}
                    className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs uppercase"
                  >
                    Hostname {sortKey === "hostname" && (sortOrder === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort("os")}
                    className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs uppercase"
                  >
                    OS {sortKey === "os" && (sortOrder === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort("compliance_score")}
                    className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs uppercase"
                  >
                    Compliance {sortKey === "compliance_score" && (sortOrder === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                  Progress
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                  Failures
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-slate-500 dark:text-slate-400 italic">
                    No endpoints match the selected filter.
                  </td>
                </tr>
              ) : (
                processedData.map((ep, idx) => (
                  <tr
                    key={ep.endpoint_id || idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{ep.hostname || "Unknown"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{ep.os || "Unknown"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase ${getRiskColor(
                          ep.compliance_score || 0
                        )} text-white`}>
                          {(ep.compliance_score || 0).toFixed(1)}%
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          {getRiskLabel(ep.compliance_score || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getRiskColor(ep.compliance_score || 0)} transition-all duration-500`}
                          style={{ width: `${Math.min(ep.compliance_score || 0, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {(ep.critical_failures || 0) + (ep.high_failures || 0) + (ep.moderate_failures || 0)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          Showing {processedData.length} of {endpoints.length} endpoints
        </div>
      </div>
    </div>
  );
});

EndpointComparisonTable.displayName = "EndpointComparisonTable";
export default EndpointComparisonTable;
