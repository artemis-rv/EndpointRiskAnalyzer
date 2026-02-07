import { useEffect, useState } from "react";
import { getEndpoints } from "../api/api";
import EndpointDetail from "../components/EndpointDetail";


export default function Endpoints() {
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);


  useEffect(() => {
    getEndpoints().then(data => setEndpoints(data.endpoints || []));
  }, []);

  return (
  <div style={{ display: "flex", gap: "20px" }}>
    
    {/* LEFT: Endpoints table */}
    <div style={{ flex: 2 }}>
      <h2>Endpoints</h2>

      <table border="1" cellPadding="8" width="100%">
        <thead>
          <tr>
            <th>Hostname</th>
            <th>OS</th>
            <th>Scans</th>
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map(ep => (
            <tr
              key={ep.endpoint_id}
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedEndpoint(ep)}
            >
              <td>{ep.hostname}</td>
              <td>{ep.os}</td>
              <td>{ep.scan_count}</td>
              <td>{ep.last_seen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* RIGHT: Detail pane */}
    <div style={{ flex: 1 }}>
      {selectedEndpoint ? (
        <EndpointDetail endpoint={selectedEndpoint} />
      ) : (
        <p>Select an endpoint to view details</p>
      )}
    </div>

  </div>
);

}
