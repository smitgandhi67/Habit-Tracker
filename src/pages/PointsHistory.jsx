import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PointsLedger from '../components/PointsLedger';

// Kid-facing read-only view of their own points history.
export default function PointsHistory() {
  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-4 flex items-center gap-2">
        <Link to="/math" className="text-slate-400 hover:text-slate-600" aria-label="Back to Math">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Points history</h1>
          <p className="text-slate-400 text-sm">Where your points came from</p>
        </div>
      </header>
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
        <PointsLedger endpoint="/api/math/ledger" />
      </div>
    </div>
  );
}
