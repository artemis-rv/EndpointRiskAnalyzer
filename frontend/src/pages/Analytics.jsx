import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { fetchOrganizationReport } from "../api/api";
import ComplianceGauge from "../components/ComplianceGauge";
import EndpointRiskDistribution from "../components/EndpointRiskDistribution";
import CriticalControlFailures from "../components/CriticalControlFailures";
import EndpointComparisonTable from "../components/EndpointComparisonTable";
import PerEndpointAnalytics from "../components/PerEndpointAnalytics";

/**
 * Enterprise Analytics Dashboard
 * 
 * Features:
 * - Automatic refresh after scan completion
 * - Debounced API calls
 * - Memoized data processing (100ms target for ≤50 endpoints)
 * - Smooth animations (≤800ms)
 * - Responsive layout with collapsing charts
 * - Lazy-loaded per-endpoint details
 */

const DEBOUNCE_DELAY = 1000; // ms

export default function Analytics() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState(null);
  const debounceTimerRef = useRef(null);

  /**
   * Fetch report data with debouncing to avoid excessive API calls.
   */
  const fetchReport = useCallback(() => {
    setLoading(true);
    fetchOrganizationReport()
      .then((data) => {
        setReportData(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to fetch organization report:", err);
        setError(err.message || "Failed to load analytics data");
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Debounced fetch to prevent rapid API calls when event fires multiple times.
   */
  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchReport();
    }, DEBOUNCE_DELAY);
  }, [fetchReport]);

  /**
   * Initial load + auto-refresh every 30 seconds.
   * Also listens for custom scan-completion event.
   */
  useEffect(() => {
    fetchReport();

    const interval = setInterval(() => {
      debouncedFetch();
    }, 30000);

    // Listen for scan completion event from Dashboard
    const handleScanComplete = () => {
      console.log("[Analytics] Scan completed, refreshing data...");
      debouncedFetch();
    };

    window.addEventListener("scanCompleted", handleScanComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener("scanCompleted", handleScanComplete);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchReport, debouncedFetch]);

  /**
   * Memoized processing of report data to avoid recalculation on renders.
   */
  const processedData = useMemo(() => {
    if (!reportData || !reportData.endpoint_table) {
      return { allControls: [], endpoints: [] };
    }

    const allControls = [];
    reportData.endpoint_table.forEach((ep) => {
      if (ep.top_control_failures && Array.isArray(ep.top_control_failures)) {
        allControls.push(...ep.top_control_failures);
      }
    });

    return {
      allControls,
      endpoints: reportData.endpoint_table || [],
    };
  }, [reportData]);

  const selectedEndpoint = useMemo(() => {
    if (!selectedEndpointId || !processedData.endpoints) return null;
    return processedData.endpoints.find((ep) => ep.endpoint_id === selectedEndpointId);
  }, [selectedEndpointId, processedData.endpoints]);

  if (loading && !reportData) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading analytics dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
        <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Error Loading Dashboard</h2>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchReport}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!reportData || !reportData.executive_summary) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen">
        <div className="max-w-2xl mx-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            No analytics data available. Run a scan to generate reports.
          </p>
        </div>
      </div>
    );
  }

  const execSummary = reportData.executive_summary;

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 min-h-screen transition-colors duration-300 space-y-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 mb-2">
            Security Posture Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
            Enterprise-grade compliance dashboard with real-time endpoint risk analysis.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                Total Endpoints
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {execSummary.total_endpoints}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                Avg Compliance
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {execSummary.overall_compliance_score.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                Critical Failures
              </p>
              <p className="text-2xl font-black text-red-600">{execSummary.total_critical_failures}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                Status
              </p>
              <p className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {execSummary.compliance_band}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Compliance Gauge */}
        <ComplianceGauge score={execSummary.overall_compliance_score} />

        {/* B. Endpoint Risk Distribution */}
        <EndpointRiskDistribution endpoints={processedData.endpoints} />

        {/* C. Top 5 Critical Failures */}
        <div className="lg:col-span-2">
          <CriticalControlFailures controls={processedData.allControls} />
        </div>

        {/* D. Endpoint Comparison Table */}
        <div className="lg:col-span-2">
          <EndpointComparisonTable
            endpoints={processedData.endpoints}
          />
        </div>
      </div>

      {/* E. Per-Endpoint Details (Lazy Loaded) */}
      {processedData.endpoints.length > 0 && (
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">
              Per-Endpoint Deep Dive
            </h3>

            <div className="flex flex-wrap gap-2 mb-6">
              {processedData.endpoints.map((ep) => (
                <button
                  key={ep.endpoint_id}
                  onClick={() =>
                    setSelectedEndpointId(
                      selectedEndpointId === ep.endpoint_id ? null : ep.endpoint_id
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedEndpointId === ep.endpoint_id
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {ep.hostname || "Unknown"} ({(ep.compliance_score || 0).toFixed(0)}%)
                </button>
              ))}
            </div>

            {selectedEndpoint && (
              <div className="animate-fade-in">
                <PerEndpointAnalytics endpoint={selectedEndpoint} />
              </div>
            )}

            {!selectedEndpoint && (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8 italic">
                Select an endpoint above to view detailed compliance and severity analysis.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer: Last Updated */}
      <div className="max-w-7xl mx-auto text-center text-xs text-slate-500 dark:text-slate-400">
        Last updated: {new Date().toLocaleTimeString()}
        {loading && <span className="ml-2 animate-pulse">Refreshing...</span>}
      </div>
    </div>
  );
}
