import type { CSSProperties } from 'react'

interface StoryBackgroundProps {
  activeIndex: number
  cardCount: number
}

export function StoryBackground({ activeIndex, cardCount }: StoryBackgroundProps) {
  const shift = cardCount > 1 ? (activeIndex / (cardCount - 1)) * 100 : 50
  const glowStyle = { '--story-glow-x': `${shift}%` } as CSSProperties

  return (
    <div className="home-story-deck__bg" aria-hidden>
      <span className="home-story-deck__marble home-story-deck__marble--base" />
      <span className="home-story-deck__marble home-story-deck__marble--depth" />
      <span className="home-story-deck__marble-veins" />
      <span className="home-story-deck__marble-wash" />
      <span className="home-story-deck__sheen" style={glowStyle} />
      <span className="home-story-deck__glow" style={glowStyle} />
      <span className="home-story-deck__shadow-pool" style={glowStyle} />
      <span className="home-story-deck__vignette" />
      <span className="home-story-deck__grain" />
    </div>
  )
}
