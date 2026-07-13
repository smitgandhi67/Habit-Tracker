import { useState } from 'react';
import { BookOpenCheck, Star, Trophy, PartyPopper } from 'lucide-react';
import { useDecode } from '../hooks/useDecode';
import { getRoot } from '../lib/roots';
import ConceptIntro from '../components/decode/ConceptIntro';
import FirstExposure from '../components/decode/FirstExposure';

// Word Decoder practice page. Runs the one-time concept intro, then works through the
// server-scheduled queue of due roots, firing the right interaction for each root's rung.
export default function DecodePage() {
  const dec = useDecode();
  const { current, summary, reward, today, cap, session, caughtUp, loading, introSeen, markIntroSeen } = dec;
  const [submitting, setSubmitting] = useState(false);

  // First-exposure: record the exposure with the server, then advance.
  async function completeExposure() {
    setSubmitting(true);
    await dec.submit(current, {});
    setSubmitting(false);
    dec.next();
  }

  const masteredPct = summary.total ? Math.round((summary.mastered / summary.total) * 100) : 0;

  return (
    <div className="px-4">
      <header className="pt-4 mb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <BookOpenCheck className="text-indigo-500" /> Word Decoder
          </h1>
          <span className="flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 font-bold text-sm px-2.5 py-1">
            <Star size={14} className="fill-violet-500 text-violet-500" /> {reward.balance}
          </span>
        </div>
        {/* mastery progress */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${masteredPct}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-500 tabular-nums">{summary.mastered}/{summary.total}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5">{summary.mastered} mastered</span>
          <span className="rounded-full bg-amber-50 text-amber-600 px-2 py-0.5">{summary.decoding} decoding</span>
          <span className="rounded-full bg-sky-50 text-sky-600 px-2 py-0.5">{summary.learning} learning</span>
          <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5">{summary.new} new</span>
        </div>
      </header>

      {!introSeen ? (
        <ConceptIntro onDone={markIntroSeen} />
      ) : loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
      ) : caughtUp ? (
        <div className="mt-6 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-6 text-center">
          <PartyPopper className="mx-auto text-emerald-500" size={32} />
          <p className="mt-2 font-bold text-slate-800">All done for today! 🎉</p>
          <p className="mt-1 text-sm text-slate-500">
            You practiced {today.attempted} {today.attempted === 1 ? 'time' : 'times'} today.
            New roots unlock again tomorrow.
          </p>
          {session.answered > 0 && (
            <p className="mt-3 text-sm font-semibold text-violet-600">+{session.points} points this session</p>
          )}
        </div>
      ) : current ? (
        <div>
          {/* session strip */}
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <span>Today: {today.attempted} done{cap.newLeft > 0 ? ` · ${cap.newLeft} new root${cap.newLeft === 1 ? '' : 's'} left` : ''}</span>
            {session.points > 0 && <span className="font-bold text-violet-500">+{session.points} pts</span>}
          </div>

          {current.interaction === 'first_exposure' ? (
            <FirstExposure root={getRoot(current.rootId)} onComplete={completeExposure} submitting={submitting} />
          ) : (
            <ReviewPlaceholder interaction={current.interaction} onSkip={dec.next} />
          )}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400 text-sm">Nothing to practice right now.</div>
      )}
    </div>
  );
}

// Temporary card for review interactions built in a later phase (free-gen, keyword recall,
// decode challenge). On a fresh account only first-exposure fires today, so this is not
// reached during normal Stage-B use; it exists so the page never dead-ends.
function ReviewPlaceholder({ interaction, onSkip }) {
  const label = { free_gen: 'Word generation', keyword_recall: 'Meaning recall', decode_challenge: 'Decode challenge' }[interaction] || 'Review';
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <Trophy className="mx-auto text-slate-300" size={28} />
      <p className="mt-2 font-semibold text-slate-500">{label} unlocks next</p>
      <p className="mt-1 text-xs text-slate-400">This review type is coming in the next build step.</p>
      <button onClick={onSkip} className="mt-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 font-semibold px-4 py-2 text-sm">Skip for now</button>
    </div>
  );
}
