export default function EndpointDetail({ endpoint }) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "15px",
        background: "#f9fafb",
      }}
    >
      <h3>Endpoint Details</h3>

      <p><strong>Hostname:</strong> {endpoint.hostname}</p>
      <p><strong>OS:</strong> {endpoint.os}</p>
      <p><strong>Endpoint ID:</strong> {endpoint.endpoint_id}</p>
      <p><strong>Last Seen:</strong> {endpoint.last_seen}</p>
      <p><strong>Total Scans:</strong> {endpoint.scan_count}</p>

      <hr />

      <button disabled>
        View Scans (next step)
      </button>
    </div>
  );
}
