import { Link, useLocation } from "react-router-dom";
import { scheduleScanAll } from "../api/api";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive =
    to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={
        isActive
          ? "font-bold text-indigo-600 dark:text-indigo-400 transition-colors duration-200"
          : "text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 font-semibold"
      }
    >
      {children}
    </Link>
  );
}

export default function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const { showNotification } = useNotification();

  const handleScanAll = async () => {
    try {
      showNotification("Scanning in progress...", "info");
      const data = await scheduleScanAll();
      if (data?.jobs_created > 0) {
        showNotification(`Scan initiated: ${data.jobs_created} jobs scheduled.`, "success");
      } else {
        showNotification("No new scans scheduled (agents may be busy or offline).", "info");
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        showNotification("Too many requests. Please wait a moment before improving scan coverage.", "error");
      } else {
        showNotification("Failed to schedule scans. Please try again later.", "error");
      }
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center gap-6 px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-soft transition-all duration-300">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-inner">
          <span className="text-white font-bold text-sm">ER</span>
        </div>
        <span className="font-semibold text-lg hidden sm:inline tracking-tight">Endpoint Risk</span>
      </div>

      <nav className="hidden md:flex items-center gap-6">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/endpoints">Endpoints</NavLink>
        <NavLink to="/posture">Posture</NavLink>
        <NavLink to="/jobs">Jobs</NavLink>
        <NavLink to="/contact">Contact Us</NavLink>
      </nav>

      <div className="flex-1" />

      <button
        onClick={handleScanAll}
        className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2 rounded-lg transition-all duration-200 font-bold text-xs uppercase tracking-widest text-white shadow-[0_0_15px_-3px_rgba(79,70,229,0.4)] hover:shadow-[0_0_20px_-3px_rgba(79,70,229,0.6)] transform hover:-translate-y-0.5 active:translate-y-0"
      >
        Scan All
      </button>

      {/* Dark Mode Toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 shadow-md hover:shadow-lg"
        aria-label="Toggle dark mode"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          // Moon icon for dark mode
          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          // Sun icon for light mode
          <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </button>

      <NavLink to="/agent">Agent</NavLink>
    </div>
  );
}

