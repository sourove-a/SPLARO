interface StoryProgressProps {
  activeIndex: number
  count: number
  /** Infinite loop deck — show soft continuous feel on the scrubber */
  loop?: boolean
}

export function StoryProgress({ activeIndex, count, loop = false }: StoryProgressProps) {
  const safeCount = Math.max(1, count)
  const thumbWidth = 100 / safeCount
  const thumbLeft = (activeIndex / safeCount) * 100

  return (
    <div className="home-story-deck__progress-wrap">
      <div
        className="home-story-deck__progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={safeCount}
        aria-valuenow={activeIndex + 1}
        aria-label={
          loop
            ? `Story ${activeIndex + 1} of ${safeCount}, loops continuously`
            : `Story ${activeIndex + 1} of ${safeCount}`
        }
      >
        <span className="home-story-deck__progress-track" aria-hidden>
          <span
            className="home-story-deck__progress-thumb"
            style={{ width: `${thumbWidth}%`, left: `${thumbLeft}%` }}
          />
        </span>
      </div>
      {loop ? (
        <span className="home-story-deck__loop-hint" aria-hidden>
          Endless
        </span>
      ) : null}
    </div>
  )
}
