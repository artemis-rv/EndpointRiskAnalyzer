import { useEffect, useState } from "react";
import {
  getEndpoints,
  triggerAnalysis,
  getLatestPosture,
} from "../api/api";

import Interpretation from "../components/Interpretation";
import EndpointScans from "../components/EndpointScans";


async function scheduleScanAll() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/jobs/scan/all", {
      method: "POST",
    });
    const data = await res.json();
    alert(`Scheduled scans for ${data.jobs_created} endpoints`);
  } catch (err) {
    alert("Failed to schedule scan jobs");
  }
}


export default function Dashboard() {
  const [endpoints, setEndpoints] = useState([]);
  const [posture, setPosture] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);


  useEffect(() => {
    getEndpoints().then((data) => setEndpoints(data.endpoints || []));
    getLatestPosture().then(setPosture);
  }, []);

  return (
    <div>
      <h1>Org Security Posture Dashboard</h1>

      <button onClick={triggerAnalysis}>
        Run Systemic Analysis
      </button>
      
      <div className="bg-blue-600 text-white p-4 rounded-lg">
  Tailwind is working
</div>


      <button onClick={scheduleScanAll}>
      Schedule Scan (All Endpoints)
      </button>


      <h2>Endpoints</h2>
      <ul>
        {endpoints.map((ep) => (
          <li key={ep.endpoint_id}>
            <button
              onClick={() => setSelectedEndpoint(ep.endpoint_id)}
              style={{ marginRight: "10px" }}
            >
              View Scans
            </button>
            {ep.hostname} ({ep.os}) – Scans: {ep.scan_count}
          </li>
        ))}
      </ul>
            {selectedEndpoint && (
        <EndpointScans
          endpointId={selectedEndpoint}
          onClose={() => setSelectedEndpoint(null)}
        />
      )}



      <h2>Latest Posture</h2>
      <pre>
        {posture ? JSON.stringify(posture, null, 2) : "No posture yet"}
      </pre>

      <h2>Interpretation</h2>
      <Interpretation />

    </div>
  );
}
