import React from "react";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          Risk Intel Login
        </h1>
        {/* Placeholder form; actual auth not implemented */}
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Authentication coming soon.
        </p>
      </div>
    </div>
  );
}
