import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/**
 * CriticalControlFailures: Horizontal bar chart of top 5 most-failed CIS controls.
 * Sorted descending by failure count.
 */
const CriticalControlFailures = React.memo(({ controls = [] }) => {
  const chartData = useMemo(() => {
    // Count failures per control ID
    const failureMap = {};

    controls.forEach((control) => {
      const controlId = control.control_id || "Unknown";
      const name = control.name || "Unnamed Control";
      const key = `${controlId}: ${name}`;

      failureMap[key] = (failureMap[key] || 0) + 1;
    });

    // Convert to array and sort descending
    return Object.entries(failureMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [controls]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
          Top 5 Critical Control Failures
        </h3>
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          No control failures detected.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
        Top 5 Critical Control Failures
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" allowDecimals={false} />
          <YAxis dataKey="name" type="category" stroke="#94a3b8" width={180} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            contentStyle={{
              borderRadius: "8px",
              backgroundColor: "#1e293b",
              border: "none",
              color: "#fff",
            }}
          />
          <Bar
            dataKey="count"
            fill="#ef4444"
            radius={[0, 4, 4, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

CriticalControlFailures.displayName = "CriticalControlFailures";
export default CriticalControlFailures;
