import { useEffect, useState } from 'react';

const EMOJIS = ['⭐', '✨', '🎉', '🔥', '💜', '🌟'];

// A short confetti burst overlaying its (position: relative) parent. Re-fires whenever
// `burstKey` changes; `big` throws more, larger particles for milestone combos. Purely
// decorative and pointer-transparent, so it never blocks the input underneath.
export default function ComboCelebrate({ burstKey, big }) {
  const [parts, setParts] = useState([]);

  useEffect(() => {
    if (!burstKey) return;
    const n = big ? 24 : 12;
    const items = Array.from({ length: n }, (_, i) => ({
      id: `${burstKey}-${i}`,
      left: Math.round(Math.random() * 100),
      delay: Math.random() * 0.15,
      dur: 0.7 + Math.random() * 0.5,
      rot: Math.round((Math.random() * 2 - 1) * 200),
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      size: big ? 20 + Math.random() * 16 : 14 + Math.random() * 10,
    }));
    setParts(items);
    const t = setTimeout(() => setParts([]), 1400);
    return () => clearTimeout(t);
  }, [burstKey, big]);

  if (parts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      <style>{'@keyframes comboFall{0%{transform:translateY(-15%) rotate(0);opacity:1}100%{transform:translateY(130%) rotate(var(--rot));opacity:0}}'}</style>
      {parts.map(p => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            fontSize: `${p.size}px`,
            '--rot': `${p.rot}deg`,
            animation: `comboFall ${p.dur}s ease-in ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
