import React from "react";
import Card from "../components/Card";

export default function Guidelines() {
    return (
        <div className="p-8 max-w-5xl mx-auto space-y-10 animate-fade-in text-slate-900 dark:text-slate-100">

            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                    Compliance Guidelines & Matrices
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Reference materials for understanding the organization's security posture grading mechanism and compliance standards.
                </p>
            </div>

            {/* Grading Matrix Guide */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b border-slate-200 dark:border-slate-700 pb-2">Organizational Grading Matrix</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Hardened */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-4 h-4 rounded-full bg-green-500"></div>
                            <h3 className="font-bold text-lg text-green-900 dark:text-green-400">Hardened</h3>
                        </div>
                        <div className="text-3xl font-black text-green-700 dark:text-green-500 mb-2">85 - 100%</div>
                        <p className="text-sm text-green-800 dark:text-green-300">
                            Outstanding compliance. The endpoint is highly secure, fully patched, runs necessary active defenses, and adheres to strict CIS baselines.
                        </p>
                    </div>

                    {/* Moderate */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                            <h3 className="font-bold text-lg text-yellow-900 dark:text-yellow-400">Moderate</h3>
                        </div>
                        <div className="text-3xl font-black text-yellow-700 dark:text-yellow-500 mb-2">65 - 84%</div>
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            Acceptable baseline, but requires attention. May have excessive software installed, a few highly permissive rules, or lacks full audit logging.
                        </p>
                    </div>

                    {/* At Risk */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                            <h3 className="font-bold text-lg text-orange-900 dark:text-orange-400">At Risk</h3>
                        </div>
                        <div className="text-3xl font-black text-orange-700 dark:text-orange-500 mb-2">45 - 64%</div>
                        <p className="text-sm text-orange-800 dark:text-orange-300">
                            High chance of compromise. Non-compliant configurations detected, potentially dangerous ports open, or missing basic defenses.
                        </p>
                    </div>

                    {/* Critical */}
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-4 h-4 rounded-full bg-red-500"></div>
                            <h3 className="font-bold text-lg text-red-900 dark:text-red-400">Critical</h3>
                        </div>
                        <div className="text-3xl font-black text-red-700 dark:text-red-500 mb-2">&lt; 45%</div>
                        <p className="text-sm text-red-800 dark:text-red-300">
                            Severe security hazard. Endpoint is actively exposing the network. Likely disabled Antivirus or Firewalls, and critical CIS failures.
                        </p>
                    </div>

                </div>
            </div>

            {/* Documentation / PDF Dummy Card */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b border-slate-200 dark:border-slate-700 pb-2">Reference Documents</h2>
                <Card title="Official Organization CIS Benchmarks">
                    <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-row items-center gap-4">
                            <div className="p-3 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg max-w-sm truncate whitespace-nowrap" title="CIS_Microsoft_Windows_11_Enterprise_Benchmark_v5.0.0.pdf">CIS_Microsoft_Windows_11_Enterprise_Benchmark_v5.0.0.pdf</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Last updated: Mar 2026 • 8.0 MB</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4 md:mt-0">
                            <a title="Open in New Tab" href="/CIS_Microsoft_Windows_11_Enterprise_Benchmark_v5.0.0.pdf" target="_blank" rel="noopener noreferrer" className="px-4 py-2 flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors">
                                <svg alt="Open in New Tab" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>

                            </a>
                            <a title="Download" href="/CIS_Microsoft_Windows_11_Enterprise_Benchmark_v5.0.0.pdf" download="CIS_Microsoft_Windows_11_Enterprise_Benchmark_v5.0.0.pdf" className="px-4 py-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-soft">
                                <svg alt="Download" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>

                            </a>
                        </div>
                    </div>
                </Card>
            </div>

        </div>
    );
}
