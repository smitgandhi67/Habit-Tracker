import { Link } from 'react-router-dom';
import { ChevronLeft, Compass, BookOpen, HandHelping, Brain, Coins, HeartHandshake, MessagesSquare, Sprout } from 'lucide-react';
import { getDomain } from '../lib/capabilities/domains';

// The one-page parent operating guide (handover_1.md §10.4). The handover's core
// claim: the activity and the skill are NOT the same thing — "implementation quality
// is where the effect lives or dies." These six rules are the Layer-3 approach that
// converts a context into a capability. Each ties to the domains it builds and, where
// there's a checked anchor, points at the evidence page.
const PRINCIPLES = [
  {
    icon: HandHelping,
    title: 'Don’t rescue',
    rule: 'Let the struggle happen. Step in only when they’re past frustrated into shutting down.',
    why: 'Frustration tolerance and problem-solving form in the gap between “stuck” and “solved.” Rescue closes the gap and the rep is lost.',
    do: 'Ask “what have you tried?” and wait. Offer a hint, not the answer.',
    dont: 'Take over, fix it, or finish it for them to save time.',
    domains: ['emotional', 'cognitive'],
  },
  {
    icon: Brain,
    title: 'Make them retrieve',
    rule: 'Learning means pulling it back out of memory — not putting it back in front of their eyes.',
    why: 'Practice testing and spaced practice are the two highest-utility study techniques; rereading and highlighting are low-utility.',
    do: 'Close the book and quiz. Space it out (day 1 / 3 / 7).',
    dont: 'Let “studying” mean rereading or highlighting.',
    domains: ['metacognition', 'cognitive'],
    citeKey: 'dunlosky2013',
  },
  {
    icon: Coins,
    title: 'Give real decisions',
    rule: 'Hand over choices that carry real consequences — including real money.',
    why: 'Agency forms when a decision is actually theirs and the outcome lands on them. Financial lessons stick most at the “teachable moment.”',
    do: 'Give a real budget/decision they own, then let the result stand.',
    dont: 'Simulate it, then override the choice you didn’t like.',
    domains: ['agency', 'character'],
    citeKey: 'kaiser_finlit',
  },
  {
    icon: HeartHandshake,
    title: 'Coach the feeling',
    rule: 'Name the emotion and settle it first; problem-solve second.',
    why: 'Social-emotional skills are trainable, and a flooded brain can’t reason. Label → regulate → then tackle the problem.',
    do: 'Name it (“that’s frustrating”), validate, co-regulate, then problem-solve together.',
    dont: 'Dismiss it (“you’re fine”) or jump to fixing before the feeling settles.',
    domains: ['emotional', 'social'],
    citeKey: 'durlak2011',
  },
  {
    icon: MessagesSquare,
    title: 'Embed metacognition',
    rule: 'Ask how they know — don’t run a separate “thinking skills” drill.',
    why: 'Metacognition gives the biggest gains when it’s embedded in real subject work, not taught as a standalone module.',
    do: 'Ask “how do you know? what’s your plan? what would you do differently?”',
    dont: 'Bolt on abstract brain-training in place of the real task.',
    domains: ['metacognition'],
    citeKey: 'eef_metacognition',
  },
  {
    icon: Sprout,
    title: 'Praise the process',
    rule: 'Name the strategy and effort that worked — not the talent.',
    why: 'Process praise builds a growth mindset and keeps them reaching past their current level (“not yet”).',
    do: 'Point at the specific move: “switching approaches there is what cracked it.”',
    dont: 'Praise being “smart” or “a natural” — it makes hard things feel like a verdict.',
    domains: ['emotional', 'character'],
  },
];

function DomainChips({ keys }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {keys.map(k => {
        const d = getDomain(k);
        if (!d) return null;
        return (
          <span
            key={k}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              d.foundational ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {d.short}
          </span>
        );
      })}
    </div>
  );
}

export default function SkillsCoaching() {
  return (
    <div className="px-4 pb-12 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <Compass size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">How to coach it</h1>
      </div>

      {/* Core principle */}
      <div className="mt-2 rounded-2xl bg-violet-600 text-white p-4 shadow-sm">
        <p className="text-sm font-semibold">The activity and the skill are not the same thing.</p>
        <p className="text-xs text-violet-100 mt-1 leading-relaxed">
          Cooking trains problem-solving only if they troubleshoot the flopped recipe instead of being
          rescued. The six rules below are the <span className="font-semibold">approach</span> that turns
          any activity into a capability — this is the part the research says makes interventions work or fail.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {PRINCIPLES.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-violet-600" />
                </span>
                <h2 className="text-sm font-bold text-slate-800">{p.title}</h2>
              </div>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">{p.rule}</p>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{p.why}</p>

              <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-xs">
                <p className="flex gap-1.5 text-emerald-700">
                  <span className="font-bold shrink-0">Do</span>
                  <span className="text-slate-600">{p.do}</span>
                </p>
                <p className="flex gap-1.5 text-rose-600">
                  <span className="font-bold shrink-0">Don’t</span>
                  <span className="text-slate-600">{p.dont}</span>
                </p>
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <DomainChips keys={p.domains} />
                {p.citeKey && (
                  <Link to="/skills/reference" className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700">
                    <BookOpen size={12} /> evidence
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link
        to="/skills/library"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors"
      >
        <Compass size={20} className="text-slate-600 shrink-0" />
        <span>
          <span className="block text-sm font-semibold text-slate-800">Activity library</span>
          <span className="block text-xs text-slate-500">Each activity’s “how to run it” note applies these rules.</span>
        </span>
      </Link>
    </div>
  );
}
