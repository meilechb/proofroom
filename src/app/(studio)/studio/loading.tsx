export default function StudioLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-surface-2" />
      <div className="mt-2 h-4 w-80 rounded-md bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card card-pad">
            <div className="h-3 w-20 rounded bg-surface-2" />
            <div className="mt-3 h-7 w-16 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card card-pad h-48" />
        ))}
      </div>
    </div>
  );
}
