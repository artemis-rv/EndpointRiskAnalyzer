import { useEffect, useState } from "react";
import { getLatestInterpretation } from "../api/api";

export default function Interpretation() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getLatestInterpretation().then(setData);
  }, []);

  if (!data || data.status === "empty") {
    return <p>No interpretation available.</p>;
  }

  return (
    <div>
      <h2>Interpretation Summary</h2>

      <p>
        <strong>Overall Risk:</strong>{" "}
        <span style={{ color: data.risk_level === "HIGH" ? "red" : "green" }}>
          {data.risk_level}
        </span>
      </p>

      <h3>Key Findings</h3>
      <ul>
        {data.findings.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>

      <h3>Recommended Actions</h3>
      <ul>
        {data.recommendations.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
