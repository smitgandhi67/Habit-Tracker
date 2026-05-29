import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Play, Save, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { BODY_PARTS } from '../hooks/useGym';
import { normalizeExerciseName } from '../lib/exerciseName';

export default function ManageExercisesModal({ fetchExerciseList, addExerciseTemplate, updateExerciseTemplate, deleteExerciseTemplate, onClose, onTemplateEdited, isAdmin }) {
  const [selectedPart, setSelectedPart] = useState(BODY_PARTS[0].key);
  const [exercises,    setExercises]    = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newVideo,     setNewVideo]     = useState('');
  const [adding,       setAdding]       = useState(false);
  const [error,        setError]        = useState('');
  const [editingId,    setEditingId]    = useState(null);
  const [editingUrl,   setEditingUrl]   = useState('');
  const [savingUrl,    setSavingUrl]    = useState(false);
  // Admin name/bodyPart edit state.
  const [metaEditId,     setMetaEditId]    = useState(null);
  const [metaName,       setMetaName]      = useState('');
  const [metaBodyPart,   setMetaBodyPart]  = useState('');
  const [savingMeta,     setSavingMeta]    = useState(false);

  useEffect(() => {
    load(selectedPart);
  }, [selectedPart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchExerciseList().then(setAllExercises);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nameKeyMap = useMemo(() => {
    const map = {};
    for (const ex of allExercises) {
      map[normalizeExerciseName(ex.name)] = ex.bodyPart;
    }
    return map;
  }, [allExercises]);

  async function load(bp) {
    setLoading(true);
    const list = await fetchExerciseList(bp);
    setExercises(list);
    setLoading(false);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;

    const key = normalizeExerciseName(name);
    const conflictPart = nameKeyMap[key];
    if (conflictPart) {
      const label = BODY_PARTS.find(b => b.key === conflictPart)?.label || conflictPart;
      setError(`'${name}' already exists in ${label}`);
      return;
    }

    setAdding(true);
    setError('');
    try {
      const ex = await addExerciseTemplate(name, selectedPart, newVideo.trim());
      if (ex.bodyPart === selectedPart) {
        setExercises(prev => [...prev, ex].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setAllExercises(prev => [...prev, ex]);
      setNewName('');
      setNewVideo('');
    } catch (err) {
      setError(err.message || 'Failed to add exercise');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    await deleteExerciseTemplate(id);
    setExercises(prev => prev.filter(e => e._id !== id));
    setAllExercises(prev => prev.filter(e => e._id !== id));
  }

  function startEditingUrl(ex) {
    setEditingId(ex._id);
    setEditingUrl(ex.videoUrl || '');
  }

  function cancelEditingUrl() {
    setEditingId(null);
    setEditingUrl('');
  }

  async function saveUrl(id) {
    setSavingUrl(true);
    try {
      const updated = await updateExerciseTemplate(id, { videoUrl: editingUrl.trim() });
      setExercises(prev => prev.map(e => e._id === id ? updated : e));
      cancelEditingUrl();
      toast.success('Video link saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save video link');
    } finally {
      setSavingUrl(false);
    }
  }

  function startEditingMeta(ex) {
    setMetaEditId(ex._id);
    setMetaName(ex.name);
    setMetaBodyPart(ex.bodyPart);
  }

  function cancelEditingMeta() {
    setMetaEditId(null);
    setMetaName('');
    setMetaBodyPart('');
  }

  async function saveMeta(id) {
    const trimmed = metaName.trim();
    if (!trimmed) {
      toast.error('Name required');
      return;
    }
    setSavingMeta(true);
    try {
      const updated = await updateExerciseTemplate(id, { name: trimmed, bodyPart: metaBodyPart });
      // Update full library so collision map stays current.
      setAllExercises(prev => prev.map(e => e._id === id ? { ...e, name: updated.name, bodyPart: updated.bodyPart } : e));
      // Update the currently-visible filtered list. If bodyPart moved off the
      // selected tab, drop the row; otherwise replace in place.
      setExercises(prev =>
        updated.bodyPart === selectedPart
          ? prev.map(e => e._id === id ? { ...e, ...updated } : e).sort((a, b) => a.name.localeCompare(b.name))
          : prev.filter(e => e._id !== id),
      );
      cancelEditingMeta();
      const renamed = updated.entriesUpdated || 0;
      toast.success(renamed > 0 ? `Saved · ${renamed} ${renamed === 1 ? 'entry' : 'entries'} updated` : 'Saved');
      onTemplateEdited?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSavingMeta(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAdd();
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[88svh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Manage exercises</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body part tabs */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {BODY_PARTS.map(({ key, label, emoji }) => (
              <button
                key={key}
                onClick={() => { setSelectedPart(key); setNewName(''); setError(''); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${selectedPart === key
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'
                  }`}
              >
                <span>{emoji}</span> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No exercises yet — add one below</p>
          ) : (
            <ul className="space-y-1.5 py-2">
              {exercises.map(ex => (
                <li key={ex._id} className="bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{ex.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ex.videoUrl && editingId !== ex._id && metaEditId !== ex._id && (
                        <a
                          href={ex.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-full text-violet-500 hover:bg-violet-50 transition-colors"
                          title="Open video"
                        >
                          <Play size={13} />
                        </a>
                      )}
                      {editingId !== ex._id && metaEditId !== ex._id ? (
                        <button
                          onClick={() => startEditingUrl(ex)}
                          className="text-xs text-violet-600 font-medium hover:underline px-2 py-0.5"
                        >
                          {ex.videoUrl ? 'Edit link' : 'Add link'}
                        </button>
                      ) : null}
                      {isAdmin && editingId !== ex._id && metaEditId !== ex._id && (
                        <button
                          onClick={() => startEditingMeta(ex)}
                          className="p-1 rounded-full hover:bg-violet-50 transition-colors"
                          title="Edit name / category"
                        >
                          <Pencil size={13} className="text-violet-500" />
                        </button>
                      )}
                      {isAdmin && editingId !== ex._id && metaEditId !== ex._id && (
                        <button
                          onClick={() => handleDelete(ex._id)}
                          className="p-1 rounded-full hover:bg-red-50 transition-colors"
                          title="Delete exercise"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  {metaEditId === ex._id && (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={metaName}
                        onChange={e => setMetaName(e.target.value)}
                        placeholder="Exercise name"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={metaBodyPart}
                          onChange={e => setMetaBodyPart(e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                        >
                          {BODY_PARTS.map(({ key, label, emoji }) => (
                            <option key={key} value={key}>{emoji} {label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveMeta(ex._id)}
                          disabled={savingMeta || !metaName.trim()}
                          className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                          title="Save"
                        >
                          <Save size={13} />
                        </button>
                        <button
                          onClick={cancelEditingMeta}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                  {editingId === ex._id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="url"
                        value={editingUrl}
                        onChange={e => setEditingUrl(e.target.value)}
                        placeholder="https://youtube.com/..."
                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                      <button
                        onClick={() => saveUrl(ex._id)}
                        disabled={savingUrl}
                        className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        title="Save"
                      >
                        <Save size={13} />
                      </button>
                      <button
                        onClick={cancelEditingUrl}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add exercise input */}
        <div className="px-5 pb-6 pt-3 border-t border-slate-100 shrink-0 space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder={`Add ${BODY_PARTS.find(b => b.key === selectedPart)?.label} exercise…`}
              className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || adding}
              className="flex items-center gap-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <input
            type="url"
            value={newVideo}
            onChange={e => setNewVideo(e.target.value)}
            placeholder="Optional: video URL (https://...)"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>
    </div>
  );
}
