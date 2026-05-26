import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHabitsContext } from '../hooks/useHabits';
import HabitModal from '../components/HabitModal';
import { HabitListSkeleton } from '../components/Skeleton';
import { formatFrequency } from '../lib/frequency';

const freqLabel = formatFrequency;

function SortableHabit({ habit, onEdit, onDelete, deleting }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none p-1"
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      <span className="text-2xl">{habit.emoji}</span>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 truncate">{habit.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{freqLabel(habit.frequency)}</p>
      </div>

      <button
        onClick={() => onEdit(habit)}
        className="text-slate-300 hover:text-violet-600 p-1.5 transition-colors"
        aria-label="Edit"
      >
        <Pencil size={16} />
      </button>
      <button
        onClick={() => onDelete(habit._id)}
        disabled={deleting === habit._id}
        className="text-slate-300 hover:text-red-500 p-1.5 transition-colors disabled:opacity-40"
        aria-label="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default function Habits() {
  const { habits, deleteHabit, reorderHabits, loading } = useHabitsContext();
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDelete = async (id) => {
    if (!confirm('Delete this habit and all its history?')) return;
    setDeleting(id);
    try { await deleteHabit(id); } finally { setDeleting(null); }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = habits.findIndex(h => h._id === active.id);
    const newIndex = habits.findIndex(h => h._id === over.id);
    const reordered = arrayMove(habits, oldIndex, newIndex);
    reorderHabits(reordered.map(h => h._id));
  };

  if (loading) {
    return <div className="p-4 pt-8"><HabitListSkeleton /></div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between pt-4 mb-6">
        <h1 className="text-3xl font-bold text-slate-800">My Habits</h1>
        <button
          onClick={() => setModal('add')}
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-4 py-2 flex items-center gap-1.5 text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-5xl mb-4">📋</p>
          <p className="font-semibold text-slate-600">No habits yet</p>
          <p className="text-sm mt-1">Tap Add to create your first habit</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-3 text-center">Drag ≡ to reorder</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={habits.map(h => h._id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {habits.map(h => (
                  <SortableHabit
                    key={h._id}
                    habit={h}
                    onEdit={habit => setModal({ editing: habit })}
                    onDelete={handleDelete}
                    deleting={deleting}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {modal && (
        <HabitModal
          habit={modal.editing}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
