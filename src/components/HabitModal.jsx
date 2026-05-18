import { useState } from 'react';
import { useHabitsContext } from '../hooks/useHabits';
import { X, Hash, Clock, Type } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const VALUE_TYPES = [
  { key: 'number', label: 'Number',  icon: Hash,  placeholder: 'e.g. Pages read, Glasses of water' },
  { key: 'time',   label: 'Time',    icon: Clock, placeholder: 'e.g. Minutes exercised, Hours slept' },
  { key: 'text',   label: 'Text',    icon: Type,  placeholder: 'e.g. What I read, Mood note' },
];

export default function HabitModal({ habit, onClose }) {
  const { addHabit, updateHabit } = useHabitsContext();

  const [name, setName]         = useState(habit?.name || '');
  const [emoji, setEmoji]       = useState(habit?.emoji || '💪');
  const [showPicker, setShowPicker] = useState(false);
  const [freqType, setFreqType] = useState(!habit || habit.frequency === 'daily' ? 'daily' : 'days');
  const [days, setDays]         = useState(Array.isArray(habit?.frequency) ? habit.frequency : []);
  const [hasConfig, setHasConfig] = useState(!!habit?.config?.type);
  const [configLabel, setConfigLabel] = useState(habit?.config?.label || '');
  const [configType, setConfigType]   = useState(habit?.config?.type || 'number');
  const [saving, setSaving]     = useState(false);

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const canSave = name.trim() &&
    (freqType === 'daily' || days.length > 0) &&
    (!hasConfig || configLabel.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const frequency = freqType === 'daily' ? 'daily' : days;
    const config    = hasConfig ? { label: configLabel.trim(), type: configType } : null;
    try {
      if (habit) {
        await updateHabit(habit._id, { name: name.trim(), emoji, frequency, config });
      } else {
        await addHabit({ name: name.trim(), emoji, frequency, config });
      }
      onClose();
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      onClick={() => { if (showPicker) { setShowPicker(false); return; } onClose(); }}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10 shadow-2xl overflow-y-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">{habit ? 'Edit Habit' : 'New Habit'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
        </div>

        {/* Emoji */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Icon</p>
          <button
            onClick={() => setShowPicker(p => !p)}
            className="text-4xl w-16 h-16 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all"
          >
            {emoji}
          </button>
          <p className="text-xs text-slate-400 mt-1.5">Tap to pick any emoji</p>
          {showPicker && (
            <div className="mt-3">
              <Picker data={data} onEmojiSelect={(e) => { setEmoji(e.native); setShowPicker(false); }} theme="light" previewPosition="none" skinTonePosition="none" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Name</p>
          <input
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
            placeholder="e.g. Read for 20 minutes"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus={!showPicker}
          />
        </div>

        {/* Frequency */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Frequency</p>
          <div className="flex gap-2">
            <button onClick={() => setFreqType('daily')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${freqType === 'daily' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Every day</button>
            <button onClick={() => setFreqType('days')}  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${freqType === 'days'  ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Specific days</button>
          </div>
          {freqType === 'days' && (
            <div className="flex gap-1.5 mt-3">
              {DAYS.map(d => (
                <button key={d} onClick={() => toggleDay(d)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${days.includes(d) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{d}</button>
              ))}
            </div>
          )}
        </div>

        {/* Track a value toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between py-3 border-t border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700">Track a value</p>
              <p className="text-xs text-slate-400 mt-0.5">Log a number, time, or note each day</p>
            </div>
            <button
              onClick={() => setHasConfig(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors ${hasConfig ? 'bg-violet-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hasConfig ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {hasConfig && (
            <div className="mt-3 space-y-3">
              {/* Type picker */}
              <div className="flex gap-2">
                {VALUE_TYPES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setConfigType(key)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      configType === key
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Label */}
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition text-sm"
                placeholder={VALUE_TYPES.find(t => t.key === configType)?.placeholder}
                value={configLabel}
                onChange={e => setConfigLabel(e.target.value)}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 transition-all"
        >
          {saving ? 'Saving…' : habit ? 'Save Changes' : 'Create Habit'}
        </button>
      </div>
    </div>
  );
}
