import { useEffect, useState } from "react";
import { getScans } from "../api/api";

export default function EndpointScans({ endpointId, onClose }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!endpointId) return;

    getScans(endpointId).then((data) => {
      setScans(data.scans || []);
      setLoading(false);
    });
  }, [endpointId]);

  if (!endpointId) return null;

  return (
    <div style={{ border: "1px solid #ccc", padding: "10px", marginTop: "20px" }}>
      <h3>Scans for Endpoint</h3>

      <button onClick={onClose}>Close</button>

      {loading && <p>Loading scans…</p>}

      {!loading && scans.length === 0 && <p>No scans found.</p>}

      {!loading &&
        scans.map((scan, idx) => (
          <div key={idx} style={{ marginBottom: "15px" }}>
            <p>
              <strong>Scan Time:</strong> {scan.scan_time}
            </p>
            <pre style={{ background: "#f4f4f4", padding: "10px" }}>
              {JSON.stringify(scan.scan_data, null, 2)}
            </pre>
          </div>
        ))}
    </div>
  );
}
