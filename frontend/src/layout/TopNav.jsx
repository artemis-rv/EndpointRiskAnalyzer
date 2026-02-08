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
          ? "font-semibold text-primary-300 dark:text-primary-400 hover:text-primary-200 dark:hover:text-primary-300 transition-colors duration-200"
          : "hover:text-primary-400 dark:hover:text-primary-300 text-slate-200 dark:text-slate-300 transition-colors duration-200"
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
      showNotification(`Scan completed: ${data?.jobs_created ?? 0} jobs scheduled.`, "success");
    } catch (error) {
      showNotification("Scan failed if failure.", "error");
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center gap-6 px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 border-b border-slate-700/50 dark:border-slate-800 text-white shadow-lg transition-all duration-300">
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
      </nav>

      <div className="flex-1" />

      <button
        onClick={handleScanAll}
        className="bg-primary-600 hover:bg-primary-500 active:bg-primary-700 px-4 py-2 rounded-lg transition-all duration-200 font-bold text-xs uppercase tracking-widest text-white shadow-[0_0_15px_-3px_rgba(79,70,229,0.4)] hover:shadow-[0_0_20px_-3px_rgba(79,70,229,0.6)] transform hover:-translate-y-0.5 active:translate-y-0"
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

