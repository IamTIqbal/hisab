// Shown the instant a link is tapped, while the server builds the page.
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-40" />
      <div className="leaf space-y-3 p-5">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-12 w-56" />
      </div>
      <div className="leaf overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-rule px-4 py-4 last:border-0">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
            <div className="skeleton h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
