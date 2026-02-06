import { useEffect, useState } from "react";
import {
  getEndpoints,
  triggerAnalysis,
  getLatestPosture,
} from "../api/api";

export default function Dashboard() {
  const [endpoints, setEndpoints] = useState([]);
  const [posture, setPosture] = useState(null);

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
            {ep.hostname} ({ep.os}) – Scans: {ep.scan_count}
          </li>
        ))}
      </ul>

      <h2>Latest Posture</h2>
      <pre>
        {posture ? JSON.stringify(posture, null, 2) : "No posture yet"}
      </pre>
    </div>
  );
}
