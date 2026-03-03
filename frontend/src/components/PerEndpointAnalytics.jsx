import React, { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * PerEndpointAnalytics: Doughnut chart (compliance) + stacked bar chart (severity failures).
 * Lazy-loaded per endpoint for performance.
 */
const PerEndpointAnalytics = React.memo(({ endpoint }) => {
  const complianceData = useMemo(
    () => [
      { name: "Compliant", value: Math.min(endpoint.compliance_score || 0, 100) },
      { name: "Non-Compliant", value: Math.max(100 - (endpoint.compliance_score || 0), 0) },
    ],
    [endpoint.compliance_score]
  );

  const severityData = useMemo(
    () => [
      {
        name: endpoint.hostname || "Endpoint",
        Critical: endpoint.critical_failures || 0,
        High: endpoint.high_failures || 0,
        Moderate: endpoint.moderate_failures || 0,
      },
    ],
    [endpoint]
  );

  return (
    <div className="space-y-6">
      {/* Doughnut Compliance Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
          {endpoint.hostname || "Unknown"} - Compliance Breakdown
        </h4>

        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={complianceData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              animationDuration={800}
            >
              <Cell fill="#22c55e" />
              <Cell fill="#ef4444" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-black text-green-600">
              {(endpoint.compliance_score || 0).toFixed(1)}%
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Compliant</div>
          </div>
          <div>
            <div className="text-2xl font-black text-red-600">
              {(100 - (endpoint.compliance_score || 0)).toFixed(1)}%
            </div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Non-Compliant</div>
          </div>
        </div>
      </div>

      {/* Severity Stacked Bar Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
          Severity Failures
        </h4>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={severityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis allowDecimals={false} stroke="#94a3b8" />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                borderRadius: "8px",
                backgroundColor: "#1e293b",
                border: "none",
                color: "#fff",
              }}
            />
            <Legend />
            <Bar dataKey="Critical" stackId="a" fill="#ef4444" animationDuration={800} />
            <Bar dataKey="High" stackId="a" fill="#f97316" animationDuration={800} />
            <Bar dataKey="Moderate" stackId="a" fill="#eab308" animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

PerEndpointAnalytics.displayName = "PerEndpointAnalytics";
export default PerEndpointAnalytics;
