import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

/**
 * ComplianceGauge: Circular health indicator with animated color-coded band.
 * Displays overall compliance percentage with smooth animation.
 */
const ComplianceGauge = React.memo(({ score = 0 }) => {
  // Clamp score between 0 and 100
  const normalizedScore = Math.min(Math.max(parseFloat(score) || 0, 0), 100);

  // Determine color and label based on score
  const getGaugeConfig = useMemo(() => {
    if (normalizedScore >= 85) return { color: "#22c55e", label: "Hardened", textColor: "text-green-600" };
    if (normalizedScore >= 65) return { color: "#eab308", label: "Moderate", textColor: "text-yellow-600" };
    if (normalizedScore >= 45) return { color: "#f97316", label: "At Risk", textColor: "text-orange-600" };
    return { color: "#ef4444", label: "Critical", textColor: "text-red-600" };
  }, [normalizedScore]);

  const config = getGaugeConfig;

  // Create gauge data: main segment + remainder
  const gaugeData = useMemo(
    () => [
      { name: "Score", value: normalizedScore, fill: config.color },
      { name: "Remaining", value: 100 - normalizedScore, fill: "#e2e8f0" },
    ],
    [normalizedScore, config.color]
  );

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
        Compliance Health
      </h3>

      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={gaugeData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            startAngle={180}
            endAngle={0}
            dataKey="value"
            animationDuration={800}
            animationEasing="ease-out"
          >
            {gaugeData.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6 text-center space-y-2">
        <div className={`text-4xl font-black ${config.textColor}`}>{normalizedScore.toFixed(1)}%</div>
        <div className="text-sm font-bold text-slate-600 dark:text-slate-400">{config.label}</div>
      </div>
    </div>
  );
});

ComplianceGauge.displayName = "ComplianceGauge";
export default ComplianceGauge;
