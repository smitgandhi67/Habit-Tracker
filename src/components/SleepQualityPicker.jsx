import { Star } from 'lucide-react';

export default function SleepQualityPicker({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Sleep quality">
      {[1, 2, 3, 4, 5].map(n => {
        const filled = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onChange?.(n); }}
            className={`p-1 rounded-md transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-50'}`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              size={18}
              className={filled ? 'text-amber-500' : 'text-slate-300'}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={filled ? 0 : 1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
