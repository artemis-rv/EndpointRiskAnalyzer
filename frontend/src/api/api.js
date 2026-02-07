// only 1 update to do instead of all files

const BASE_URL = "http://127.0.0.1:8000";

export async function getEndpoints() {
  const res = await fetch(`${BASE_URL}/api/endpoints`);
  return res.json();
}

export async function getScans(endpointId) {
  const res = await fetch(`${BASE_URL}/api/scans/${endpointId}`);
  return res.json();
}

export async function triggerAnalysis() {
  const res = await fetch(`${BASE_URL}/api/analyze`, { method: "POST" });
  return res.json();
}

export async function getLatestPosture() {
  const res = await fetch(`${BASE_URL}/api/posture/latest`);
  return res.json();
}

export async function triggerInterpretation(snapshotId) {
  const res = await fetch(`${BASE_URL}/api/interpret/${snapshotId}`, {
    method: "POST",
  });
  return res.json();
}

export async function getLatestInterpretation() {
  const res = await fetch("http://127.0.0.1:8000/api/interpret/latest");
  return res.json();
}

export async function scheduleScanAll() {
  const res = await fetch("http://127.0.0.1:8000/api/jobs/scan/all", {
    method: "POST",
  });
  return res.json();
}

export async function scheduleScanEndpoint(endpointId) {
  const res = await fetch(`http://127.0.0.1:8000/api/jobs/scan/${endpointId}`, {
    method: "POST",
  });
  return res.json();
}

export async function getJobs() {
  const res = await fetch("http://127.0.0.1:8000/api/jobs");
  return res.json();
}

