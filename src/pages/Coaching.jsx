import { Link } from 'react-router-dom';
import { ChevronLeft, Shield, TrendingUp, LineChart } from 'lucide-react';

// Static coaching reference — the parts of the master workout doc that don't
// belong on the structured plan (universal principles, progression rules,
// progress-tracking guidance). Updated by editing this file.
export default function Coaching() {
  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Link to="/gym" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <h1 className="text-lg font-bold text-slate-800">Coaching guide</h1>
      </div>

      {/* Core Principles */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          <Shield size={16} className="text-violet-500" />
          Core principles
        </h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li><strong>Last 2 reps</strong> of every working set should be hard — leave 1-2 reps in the tank.</li>
          <li><strong>Compounds first</strong> (heavier weight, 8-10 reps); isolation last (12-15 reps).</li>
          <li><strong>3 sets</strong> per exercise (not 2) — log more if you run warm-ups or back-off sets.</li>
          <li><strong>Increase weight</strong> when you can hit the top of the rep range with good form.</li>
          <li><strong>Rest:</strong> 90-120 s between heavy compounds, 60-90 s between isolations.</li>
          <li><strong>Warm up 8-10 min</strong> before every session — 5 min cardio + 5 min dynamic mobility + 1-2 light warmup sets on first compound.</li>
        </ul>
      </section>

      {/* Safety rules */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          <Shield size={16} className="text-emerald-500" />
          Safety rules (non-negotiable)
        </h2>
        <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
          <li>Always warm up — 5 min cardio + 5 min dynamic mobility + warmup sets.</li>
          <li>Control the eccentric — 2-3 s down, 1 s up.</li>
          <li>Never train to failure — last 2 reps hard, but stop with 1-2 in the tank.</li>
          <li>Breathe properly — exhale on exertion, never hold breath under heavy load.</li>
          <li>Stop on sharp or joint pain — muscle burn is fine; joint pain is not.</li>
          <li>No behind-the-neck movements — pulldowns and presses go to the front.</li>
          <li>Don't lock out knees/elbows under heavy load.</li>
          <li>48 hours recovery between training the same muscle.</li>
        </ol>
        <p className="text-xs text-slate-400 mt-3 italic">
          Each gym log entry has a "Form check" panel to tick these off per session.
        </p>
      </section>

      {/* Progressive overload */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          <TrendingUp size={16} className="text-violet-500" />
          Progressive overload
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          The app runs this cycle for you. Open any exercise in the log and the
          <strong> Next target</strong> card shows the weight and rep goal for that session.
        </p>
        <ol className="space-y-2.5 text-sm text-slate-700 list-decimal list-inside">
          <li>
            <strong>Earn the increase.</strong> Hit the <em>top</em> of the rep range on every prescribed set —
            10 reps × 3 sets on an 8-10 exercise, 15 × 3 on a 12-15 one — with 1-2 reps still in the tank.
          </li>
          <li>
            <strong>Take the smallest jump.</strong> 5 lb on compounds, 2.5 lb on isolation
            (2.5 / 1.25 kg). Set your own step per exercise if your machine's stack moves differently.
          </li>
          <li>
            <strong>Expect reps to collapse.</strong> At a new weight, <strong>4 reps is the floor</strong>, not a
            failure. 55 lb × 6, 5, 5 after 50 lb × 10, 10, 10 is exactly right.
          </li>
          <li>
            <strong>Climb back up.</strong> Stay at the new weight, adding reps session by session, until you are
            back to 10 (or 15) on every set. Then repeat from step 1.
          </li>
          <li>
            <strong>Under 4 reps means back off.</strong> The jump was too big — return to the weight that was
            working rather than grinding at one you cannot build from.
          </li>
        </ol>
        <div className="mt-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <strong>Warm-up sets:</strong> log them with the flame toggle. They are kept in your history but
          excluded from the maths, so a light ramp-up never blocks an increase you have earned.
        </div>
        <p className="text-sm text-slate-700 mt-3">
          <strong>Track every session</strong> — weight used, reps completed, how it felt. The recommendation is
          derived from your log every time, so skipping a suggestion or deloading on your own corrects itself.
        </p>
      </section>

      {/* Progress tracking */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          <LineChart size={16} className="text-violet-500" />
          Progress tracking
        </h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li><strong>Weekly:</strong> weigh-in (same time, same conditions); waist at navel.</li>
          <li><strong>Biweekly:</strong> photos (front, side, back) in same lighting/pose.</li>
          <li><strong>Monthly:</strong> body fat % (same method each time).</li>
          <li><strong>Every session:</strong> log weight × reps for each exercise (Gym → Log tab).</li>
        </ul>
        <p className="text-xs text-slate-400 mt-3 italic">
          Run <code className="bg-slate-100 px-1 py-0.5 rounded">node server/scripts/seedProgressHabits.js &lt;your-email&gt;</code> to
          add weigh-in, waist, photos and body-fat % as habits in <Link to="/habits" className="text-violet-600 underline">/habits</Link>.
        </p>

        <div className="mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <strong>Red flags to adjust:</strong>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>Losing more than 1.5 lb/week → eat more.</li>
            <li>Strength dropping in gym → eat more, especially carbs around workouts.</li>
            <li>No change for 3+ weeks → drop 100-150 cal/day or add 1,000 steps/day.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
