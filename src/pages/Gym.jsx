import { useState, useEffect } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Trophy, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGym, BODY_PARTS } from '../hooks/useGym';
import { useAuth } from '../context/AuthContext';
import WeeklyCoverage from '../components/WeeklyCoverage';
import GymEntryModal from '../components/GymEntryModal';
import ManageExercisesModal from '../components/ManageExercisesModal';
import ExerciseProgress from '../components/ExerciseProgress';

function bodyPartLabel(key) {
  return BODY_PARTS.find(b => b.key === key)?.label ?? key;
}

function bodyPartEmoji(key) {
  return BODY_PARTS.find(b => b.key === key)?.emoji ?? '';
}

function feelColor(feel) {
  if (feel === 'easy') return 'text-green-600 bg-green-50 border-green-200';
  if (feel === 'hard') return 'text-red-600 bg-red-50 border-red-200';
  return 'text-amber-600 bg-amber-50 border-amber-200';
}

export default function Gym() {
  const [date,       setDate]       = useState(new Date());
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editEntry,  setEditEntry]  = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [tab,        setTab]        = useState('log');

  const { user } = useAuth();
  const isAdmin = user?.email === 'amitgandhi23@gmail.com';

  const {
    entries, weekData, loading, weekLoading,
    loadEntries, loadWeek,
    fetchExerciseHistory,
    fetchExerciseList, addExerciseTemplate, deleteExerciseTemplate,
    addEntry, updateEntry, deleteEntry,
  } = useGym();

  const dateKey = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    loadEntries(date);
    loadWeek(date);
  }, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function prevDay() { setDate(d => addDays(d, -1)); }
  function nextDay() { setDate(d => addDays(d, 1)); }
  function goToday() { setDate(new Date()); }

  function openAdd()       { setEditEntry(null); setModalOpen(true); }
  function openEdit(entry) { setEditEntry(entry); setModalOpen(true); }
  function closeModal()    { setModalOpen(false); setEditEntry(null); }

  async function handleSave(payload) {
    try {
      if (editEntry) {
        await updateEntry(editEntry._id, payload);
        toast.success('Entry updated');
      } else {
        await addEntry(payload);
        toast.success('Exercise logged!');
      }
      loadWeek(date);
    } catch (err) {
      toast.error(err.message || 'Failed to save entry');
      throw err;
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteEntry(id);
      loadWeek(date);
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete entry');
    }
  }

  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.bodyPart]) acc[e.bodyPart] = [];
    acc[e.bodyPart].push(e);
    return acc;
  }, {});

  const isCurrentDay  = isToday(date);
  const formattedDate = isCurrentDay ? 'Today' : format(date, 'EEE, MMM d');

  return (
    <div className="px-4 pb-6 pt-4 max-w-lg mx-auto">
      {/* Date navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevDay} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-base font-semibold text-slate-800">{formattedDate}</span>
          {!isCurrentDay && (
            <button onClick={goToday} className="text-xs text-violet-600 font-medium hover:underline">
              Go to today
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setManageOpen(true)}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Manage exercises"
          >
            <Settings size={20} className="text-slate-500" />
          </button>
          <button onClick={nextDay} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <ChevronRight size={20} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-4">
        {[['log', 'Log'], ['progress', 'Progress']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'text-violet-600 border-violet-600'
                : 'text-slate-400 border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'progress' ? (
        <ExerciseProgress />
      ) : (
        <>
          {/* Weekly coverage */}
          {!weekLoading && (
            <WeeklyCoverage weekData={weekData} referenceDate={date} />
          )}

          {/* Entries */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🏋️</p>
              <p className="text-slate-500 text-sm">No exercises logged yet</p>
              <p className="text-slate-400 text-xs mt-1">Tap + to add your first exercise</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([bp, bpEntries]) => (
                <div key={bp}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>{bodyPartEmoji(bp)}</span>
                    {bodyPartLabel(bp)}
                  </p>
                  <div className="space-y-2">
                    {bpEntries.map(entry => (
                      <div key={entry._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800 truncate">{entry.exerciseName}</p>
                              {entry.isPersonalRecord && (
                                <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <Trophy size={11} /> PR
                                </span>
                              )}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${feelColor(entry.feel)}`}>
                                {entry.feel}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {entry.sets.map((s, i) => (
                                <span key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
                                  {s.reps} reps{s.weight ? ` × ${s.weight}kg` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEdit(entry)} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                              <Pencil size={14} className="text-slate-400" />
                            </button>
                            <button onClick={() => handleDelete(entry._id)} className="p-1.5 rounded-full hover:bg-red-50 transition-colors">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FAB */}
          <button
            onClick={openAdd}
            className="fixed bottom-24 right-5 w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-violet-700 transition-colors z-30"
          >
            <Plus size={24} />
          </button>
        </>
      )}

      {/* Log entry modal */}
      {modalOpen && (
        <GymEntryModal
          date={dateKey}
          entry={editEntry}
          fetchExerciseList={fetchExerciseList}
          fetchExerciseHistory={fetchExerciseHistory}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Manage exercises modal */}
      {manageOpen && (
        <ManageExercisesModal
          fetchExerciseList={fetchExerciseList}
          addExerciseTemplate={addExerciseTemplate}
          deleteExerciseTemplate={deleteExerciseTemplate}
          onClose={() => setManageOpen(false)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
