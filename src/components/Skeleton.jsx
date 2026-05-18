function SkeletonBlock({ className }) {
  return <div className={`bg-slate-200 rounded-xl animate-pulse ${className}`} />;
}

export function HabitListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
          <SkeletonBlock className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-1/3" />
          </div>
          <SkeletonBlock className="w-11 h-11 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}
