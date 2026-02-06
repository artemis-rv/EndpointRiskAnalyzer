import { useEffect, useState } from "react";
import {
  getEndpoints,
  triggerAnalysis,
  getLatestPosture,
} from "../api/api";

import Interpretation from "../components/Interpretation";
import EndpointScans from "../components/EndpointScans";


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
