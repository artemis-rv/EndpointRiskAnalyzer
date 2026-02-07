import { Link } from "react-router-dom";

export default function TopNav() {
  return (
    <div style={{
      padding: "12px 20px",
      background: "#1f2937",
      color: "white",
      display: "flex",
      gap: "20px"
    }}>
      <Link to="/" style={{ color: "white" }}>Dashboard</Link>
      <Link to="/endpoints" style={{ color: "white" }}>Endpoints</Link>
      <Link to="/posture" style={{ color: "white" }}>Posture</Link>
      <Link to="/jobs" style={{ color: "white" }}>Jobs</Link>
    </div>
  );
}
