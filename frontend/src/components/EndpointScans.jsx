import { useEffect, useState } from "react"
import { getScans } from "../api/api"
import { formatDateTimeIST } from "../utils/dateUtils"

export default function EndpointScans({ endpointId, onClose }) {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedScan, setExpandedScan] = useState(null)

  useEffect(() => {
    if (!endpointId) return

    setLoading(true)
    getScans(endpointId)
      .then((data) => {
        setScans(data.scans || [])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [endpointId])

  const toggleScan = (idx) => {
    setExpandedScan(expandedScan === idx ? null : idx)
  }

  const getRiskColor = (riskLevel) => {
    const level = riskLevel?.toLowerCase() || ""
    if (level.includes("critical") || level.includes("high")) return "bg-red-100 text-red-800 border-red-200"
    if (level.includes("medium") || level.includes("moderate")) return "bg-yellow-100 text-yellow-800 border-yellow-200"
    if (level.includes("low")) return "bg-green-100 text-green-800 border-green-200"
    return "bg-slate-100 text-slate-800 border-slate-200"
  }

  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <h4 className="text-lg font-semibold">Scan History</h4>
        <button
          className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:border-slate-300"
          onClick={() => onClose?.()}
        >
          Close
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 animate-pulse">
          Loading scans...
        </p>
      )}

      {!loading && scans.length === 0 && (
        <p className="text-sm text-gray-500">
          No scans available.
        </p>
      )}

      {!loading && scans.length > 0 && (
        <div className="space-y-2">
          {scans.map((scan, idx) => {
            const isExpanded = expandedScan === idx
            const riskLevel = scan.scan_data?.risk_assessment?.risk_level || "N/A"
            const riskFlags = scan.scan_data?.risk_assessment?.risk_flags || []
            const openPorts = scan.scan_data?.exposure_posture?.open_ports || []

            return (
              <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleScan(idx)}
                  className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700">
                      {formatDateTimeIST(scan.scan_time)}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRiskColor(riskLevel)}`}>
                      {riskLevel}
                    </span>
                    <span className="text-xs text-gray-500">
                      {openPorts.length} open port{openPorts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Risk Flags Section */}
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 mb-2">Risk Flags</h5>
                        {riskFlags.length === 0 ? (
                          <p className="text-xs text-gray-500">No risk flags detected</p>
                        ) : (
                          <ul className="space-y-1">
                            {riskFlags.map((flag, flagIdx) => (
                              <li key={flagIdx} className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">⚠</span>
                                <span className="text-xs text-slate-700">{flag}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Open Ports Section */}
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 mb-2">Open Ports</h5>
                        {openPorts.length === 0 ? (
                          <p className="text-xs text-gray-500">No open ports detected</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {openPorts.map((port, portIdx) => (
                              <span
                                key={portIdx}
                                className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-mono"
                              >
                                {port}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Details */}
                    {scan.scan_data?.risk_assessment?.risk_score !== undefined && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Risk Score:</span> {scan.scan_data.risk_assessment.risk_score}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
