import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StoryProgress } from './StoryProgress'

interface StoryNavProps {
  activeIndex: number
  count: number
  onPrev: () => void
  onNext: () => void
}

export function StoryNav({ activeIndex, count, onPrev, onNext }: StoryNavProps) {
  return (
    <div className="home-story-deck__nav">
      <button
        type="button"
        className="home-story-deck__arrow home-story-deck__arrow--prev"
        onClick={onPrev}
        aria-label="Previous story card"
      >
        <ChevronLeft strokeWidth={1.5} aria-hidden />
      </button>

      <StoryProgress activeIndex={activeIndex} count={count} loop />

      <button
        type="button"
        className="home-story-deck__arrow home-story-deck__arrow--next"
        onClick={onNext}
        aria-label="Next story card"
      >
        <ChevronRight strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  )
}
