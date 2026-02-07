import { useEffect, useState } from "react"
import { getScans } from "../api/api"
import { formatDateTimeIST } from "../utils/dateUtils"

export default function EndpointScans({ endpointId, onClose }) {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(false)

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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2 pr-4 font-medium">Scan Time</th>
                <th className="py-2 pr-4 font-medium">Risk</th>
                <th className="py-2 pr-4 font-medium">Open Ports</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scans.map((scan, idx) => (
                <tr key={idx} className="hover:bg-slate-100">
                  <td className="py-2 pr-4">
                    {formatDateTimeIST(scan.scan_time)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-800">
                      {scan.scan_data?.risk_assessment?.risk_level || "N/A"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {scan.scan_data?.exposure_posture?.open_ports
                      ? scan.scan_data.exposure_posture.open_ports.length
                      : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
