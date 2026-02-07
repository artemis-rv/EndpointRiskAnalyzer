import { Link } from "react-router-dom";
import { scheduleScanAll } from "../api/api";




export default function TopNav() {
  return (
    <div className="flex items-center gap-6 px-6 py-3 bg-slate-900 text-white">

      {/* Left side navigation */}
      <Link to="/" className="font-semibold hover:text-indigo-400">
        Dashboard
      </Link>
      <Link to="/endpoints" className="hover:text-indigo-400">
        Endpoints
      </Link>
      <Link to="/posture" className="hover:text-indigo-400">
        Posture
      </Link>
      <Link to="/jobs" className="hover:text-indigo-400">
        Jobs
      </Link>

      {/* Spacer pushes button to the right */}
      <div className="flex-1"></div>

      {/* Scan All Button */}
      <button
        onClick={() => scheduleScanAll()}
        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition font-medium"
      >
        Scan All Endpoints
      </button>

      <Link to="/agent" className="hover:text-indigo-400">
        Agent
      </Link>


    </div>
  );
}

