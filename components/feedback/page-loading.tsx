/**
 * Flat loading state. No skeleton pulses, no shimmer. Just a small
 * mono label top-left + a thin red-line progress indicator at the top
 * of the viewport. Apple × Nothing OS: silent and precise.
 *
 * If a specific page needs denser loading, override by adding a local
 * `loading.tsx` that renders whatever fits that context.
 */
export function PageLoading() {
  return (
    <div
      className="relative min-h-[40vh]"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Thin horizontal red indeterminate line — anchored to top of content */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden rounded-full bg-transparent"
      >
        <div className="h-full w-1/3 bg-[var(--accent-red)] animate-[loading-slide_1.1s_ease-in-out_infinite]" />
      </div>

      <div className="pt-6">
        <span className="label-mono">Loading</span>
      </div>

      <style>{`
        @keyframes loading-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      <span className="sr-only">Loading page content…</span>
    </div>
  )
}

/** Compact loading for modals / sheets / smaller panels. Flat, no pulse. */
export function InlineLoading() {
  return (
    <div
      className="flex items-center gap-2 text-[var(--fg-muted)]"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="label-mono">Loading</span>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
