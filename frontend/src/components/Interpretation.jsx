import { useEffect, useState } from "react";
import { getLatestInterpretation } from "../api/api";

export default function Interpretation() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getLatestInterpretation().then(setData);
  }, []);

  if (!data || data.status === "empty") {
    return <p>No interpretation available yet.</p>;
  }

  const interp = data.interpretation;

  if (!interp) {
    return <p>Interpretation data malformed.</p>;
  }

  return (
    <div>
      <h2>Organizational Interpretation</h2>

      <h3>Overview</h3>
      <p>
        <strong>Total Hosts Analyzed:</strong>{" "}
        {interp.organization_overview?.total_hosts_analyzed}
      </p>
      <p>
        <strong>Analysis Scope:</strong>{" "}
        {interp.organization_overview?.analysis_scope}
      </p>

      <h3>Key Observations</h3>
      <ul>
        {interp.key_observations?.map((obs, idx) => (
          <li key={idx}>{obs}</li>
        ))}
      </ul>

      <h3>Context & Limitations</h3>
      <ul>
        {interp.context_notes?.map((note, idx) => (
          <li key={idx}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
