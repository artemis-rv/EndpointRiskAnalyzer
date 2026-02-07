import { Link, useLocation } from "react-router-dom";
import { scheduleScanAll } from "../api/api";

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive =
    to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={
        isActive
          ? "font-semibold text-indigo-300 hover:text-indigo-200"
          : "hover:text-indigo-400 text-slate-200"
      }
    >
      {children}
    </Link>
  );
}

export default function TopNav() {
  return (
    <div className="flex items-center gap-6 px-6 py-3 bg-slate-900 text-white">

      <NavLink to="/">Dashboard</NavLink>
      <NavLink to="/endpoints">Endpoints</NavLink>
      <NavLink to="/posture">Posture</NavLink>
      <NavLink to="/jobs">Jobs</NavLink>

      <div className="flex-1" />

      <button
        onClick={() => scheduleScanAll().then((data) => alert(data?.message ?? `Scheduled ${data?.jobs_created ?? 0} scan(s).`)).catch(() => alert("Failed to schedule scans."))}
        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition font-medium text-white"
      >
        Scan All Endpoints
      </button>

      <NavLink to="/agent">Agent</NavLink>
    </div>
  );
}

