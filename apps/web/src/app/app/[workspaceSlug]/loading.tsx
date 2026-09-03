export default function WorkspaceLoading() {
  return (
    <main className="min-h-screen bg-[var(--surface)] p-7">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-slate-200" />
        <div className="mt-6 h-44 rounded-2xl bg-slate-200" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    </main>
  );
}
