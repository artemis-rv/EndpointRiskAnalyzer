export default function Agent() {
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      
      <h1 className="text-2xl font-semibold mb-4">
        Endpoint Agent
      </h1>

      <div className="bg-white rounded-xl shadow p-6 max-w-3xl">

        <p className="text-gray-700 mb-4">
          The Endpoint Agent is a lightweight background service that runs on
          each system, collects posture data, and securely communicates with the
          central management server.
        </p>

        <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
          <li>Runs silently in the background</li>
          <li>Automatically registers with the backend</li>
          <li>Polls for scan jobs securely</li>
          <li>Does not require user interaction</li>
        </ul>

        <a
          href="/agent/EndpointAgent.exe"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg transition font-medium"
        >
          Download Agent (Windows)
        </a>

        <div className="mt-6 text-sm text-gray-500">
          <p>
            For large deployments, the agent can be distributed using standard
            enterprise tools such as Group Policy, SCCM, Intune, or endpoint
            management platforms.
          </p>
        </div>

      </div>
    </div>
  );
}
