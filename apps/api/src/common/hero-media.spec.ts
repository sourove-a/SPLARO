import {
  canonicalizeHeroMediaUrl,
  classifyHeroMedia,
  isDirectVideoUrl,
  isHeroVideoUrl,
  parseVimeoId,
  parseYoutubeId,
} from '@splaro/config'

describe('hero-media', () => {
  it('parses YouTube watch / share / shorts / embed ids', () => {
    expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYoutubeId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parses Vimeo ids', () => {
    expect(parseVimeoId('https://vimeo.com/123456789')).toBe('123456789')
    expect(parseVimeoId('https://player.vimeo.com/video/123456789')).toBe('123456789')
  })

  it('detects direct mp4 including Pexels video-files', () => {
    expect(isDirectVideoUrl('/uploads/hero/eid.mp4')).toBe(true)
    expect(
      isDirectVideoUrl(
        'https://videos.pexels.com/video-files/857195/857195-hd_1920_1080_30fps.mp4',
      ),
    ).toBe(true)
    expect(isHeroVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isHeroVideoUrl('/images/hero/new-season-1600.webp')).toBe(false)
  })

  it('classifies YouTube with a thumbnail poster', () => {
    const media = classifyHeroMedia('https://youtu.be/dQw4w9WgXcQ')
    expect(media.kind).toBe('youtube')
    expect(media.youtubeId).toBe('dQw4w9WgXcQ')
    expect(media.poster).toContain('i.ytimg.com/vi/dQw4w9WgXcQ')
  })

  it('adds https to scheme-less known hosts', () => {
    expect(canonicalizeHeroMediaUrl('youtu.be/dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ')
  })
})
