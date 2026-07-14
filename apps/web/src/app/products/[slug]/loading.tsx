export default function ProductLoading() {
  return (
    <div className="pp-root pp-view" aria-busy="true" aria-label="Loading product">
      <div className="pp-wrap">
        <div className="pp-breadcrumb">
          <span className="h-3 w-24 animate-pulse rounded bg-black/8" />
          <span className="h-3 w-16 animate-pulse rounded bg-black/6" />
        </div>
        <div className="pp-grid">
          <div className="pp-gallery">
            <div className="pp-gallery__main aspect-[4/5] animate-pulse rounded-[20px] bg-black/6" />
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 w-16 animate-pulse rounded-xl bg-black/5" />
              ))}
            </div>
          </div>
          <aside className="pp-details space-y-4">
            <div className="h-4 w-28 animate-pulse rounded bg-black/6" />
            <div className="h-8 w-full max-w-md animate-pulse rounded bg-black/8" />
            <div className="h-6 w-32 animate-pulse rounded bg-black/6" />
            <div className="h-12 w-full animate-pulse rounded-2xl bg-black/5" />
            <div className="h-12 w-full animate-pulse rounded-2xl bg-black/8" />
          </aside>
        </div>
      </div>
    </div>
  )
}
