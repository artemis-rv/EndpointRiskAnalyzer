export default function Agent() {
  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-8 bg-primary-600 rounded-full"></div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Endpoint Agent</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 space-y-6">
            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">What does it do?</h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-4">
                The Endpoint Risk Agent is a high-performance, lightweight background service designed to monitor your system's security posture in real-time. It acts as the "eyes and ears" of the central analyzer.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: "Posture Collection", desc: "Inventories OS version, security patches, and system configs." },
                  { title: "Network Audit", desc: "Monitors listening ports and active network connections." },
                  { title: "Silent Operation", desc: "Runs with minimal CPU/Memory footprint in the background." },
                  { title: "Secure Polling", desc: "Periodically checks for new scan jobs via encrypted channels." }
                ].map((item, i) => (
                  <li key={i} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xs font-black text-primary-600 dark:text-primary-400 uppercase mb-1">{item.title}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-500 font-medium leading-tight">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Manual Installation</h2>
              <ol className="space-y-4">
                {[
                  "Download the `EndpointAgent.exe` executable using the button to the right.",
                  "Run the installer with Administrative privileges to allow system-level auditing.",
                  "The agent will automatically detect and register with this server instance.",
                  "Verify registration by checking the 'Endpoints' page for your hostname."
                ].map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-6 h-6 bg-slate-900 dark:bg-primary-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-primary-600 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h2 className="text-xl font-black uppercase tracking-tight mb-2">Ready to Secure?</h2>
                <p className="text-primary-100 text-xs font-medium mb-6 leading-relaxed">Download the latest Windows binary and begin your endpoint audit today.</p>
                <a
                  href="/agent/EndpointAgent.exe"
                  className="block w-full text-center bg-white text-primary-600 hover:bg-primary-50 px-6 py-4 rounded-xl transition-all font-black text-sm uppercase tracking-widest shadow-xl active:scale-95"
                >
                  Download Agent
                </a>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
            </div>

            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3">Enterprise Deployment</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                For large-scale environments, the agent supports automated deployment via MST/MSI wrappers.
                Compatible with:
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Group Policy (GPO)", "Microsoft Intune", "SCCM / MECM", "PDQ Deploy"].map((tool, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-md border border-slate-200 dark:border-slate-600">
                    {tool}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
