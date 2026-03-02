import React, { useEffect, useState } from "react";
import {
    PieChart,
    Pie,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import Card from "../components/Card";

export default function Analysis() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
        // Auto-update every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            // Get base URL dynamically or fallback to localhost
            const baseUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
            const res = await fetch(`${baseUrl}/api/analytics/`);
            if (!res.ok) throw new Error("Failed to fetch analytics data");
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading analytics...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!data || data.status === "empty") {
        return <div className="p-8 text-center text-slate-500 font-medium">No analytics data available yet. Waiting for endpoint scans.</div>;
    }

    // Pre-defined Recharts Colors
    // Green = Hardened, Yellow = Moderate, Orange = At Risk, Red = Critical
    const HEALTH_COLORS = {
        Hardened: "#22c55e", // green-500
        Moderate: "#eab308", // yellow-500
        "At Risk": "#f97316", // orange-500
        Critical: "#ef4444", // red-500
    };

    // Custom color generator for endpoint pie
    const getScoreColor = (score) => {
        if (score >= 85) return HEALTH_COLORS.Hardened;
        if (score >= 65) return HEALTH_COLORS.Moderate;
        if (score >= 45) return HEALTH_COLORS["At Risk"];
        return HEALTH_COLORS.Critical;
    };
    // Pre-calculate fills to avoid deprecated Recharts <Cell> components
    const healthData = (data.health_classification || []).map(entry => ({
        ...entry,
        fill: HEALTH_COLORS[entry.name] || "#CBD5E1"
    }));

    const complianceData = (data.compliance_scores || []).map(entry => ({
        ...entry,
        fill: getScoreColor(entry.value)
    }));

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                        Posture Analysis
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Visual analytics engine for organizational security posture.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* 1. Endpoint Health Classification Pie */}
                <Card title="Endpoint Health Classification">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={healthData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', backgroundColor: '#1e293b', border: 'none', color: '#fff' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>

                {/* 2. Organizational Compliance Distribution Bar */}
                <Card title="Compliance Score Distribution">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={data.compliance_distribution}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="range" stroke="#94a3b8" />
                            <YAxis allowDecimals={false} stroke="#94a3b8" />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ borderRadius: '8px', backgroundColor: '#1e293b', border: 'none', color: '#fff' }}
                            />
                            <Bar dataKey="count" name="Endpoints" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* 3. Per-endpoint compliance score Pie */}
                <Card title="Per-Endpoint Compliance Scores">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={complianceData}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                dataKey="value"
                                nameKey="name"
                                label={({ name, value }) => `${name}: ${value}%`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', backgroundColor: '#1e293b', border: 'none', color: '#fff' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>

                {/* 4. Total vs Critical Endpoints Bar */}
                <Card title="Total Endpoints vs Critical Risk">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={data.endpoints_vs_critical}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis allowDecimals={false} stroke="#94a3b8" />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ borderRadius: '8px', backgroundColor: '#1e293b', border: 'none', color: '#fff' }}
                            />
                            <Legend />
                            <Bar dataKey="Total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

            </div>
        </div>
    );
}
