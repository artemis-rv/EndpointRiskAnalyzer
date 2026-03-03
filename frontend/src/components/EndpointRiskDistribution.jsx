import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/**
 * EndpointRiskDistribution: Vertical bar chart showing distribution across risk categories.
 * Categories: Hardened, Moderate, At Risk, Critical.
 */
const EndpointRiskDistribution = React.memo(({ endpoints = [] }) => {
  const chartData = useMemo(() => {
    const distribution = {
      Hardened: 0,
      Moderate: 0,
      "At Risk": 0,
      Critical: 0,
    };

    endpoints.forEach((ep) => {
      const score = ep.compliance_score || 0;
      if (score >= 85) distribution.Hardened++;
      else if (score >= 65) distribution.Moderate++;
      else if (score >= 45) distribution["At Risk"]++;
      else distribution.Critical++;
    });

    return [
      {
        category: "Distribution",
        Hardened: distribution.Hardened,
        Moderate: distribution.Moderate,
        "At Risk": distribution["At Risk"],
        Critical: distribution.Critical,
      },
    ];
  }, [endpoints]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
        Endpoint Risk Distribution
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="category" stroke="#94a3b8" />
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
          <Bar dataKey="Hardened" fill="#22c55e" radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar dataKey="Moderate" fill="#eab308" radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar dataKey="At Risk" fill="#f97316" radius={[4, 4, 0, 0]} animationDuration={800} />
          <Bar dataKey="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

EndpointRiskDistribution.displayName = "EndpointRiskDistribution";
export default EndpointRiskDistribution;
