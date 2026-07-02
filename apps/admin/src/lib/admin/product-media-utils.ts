export const PRODUCT_MEDIA_VIDEO_ALT = 'media:video'

export function parseProductMedia(images?: { url: string; altText?: string | null }[]) {
  let videoUrl = ''
  const imageUrls: string[] = []
  for (const img of images ?? []) {
    if (img.altText === PRODUCT_MEDIA_VIDEO_ALT) {
      if (!videoUrl) videoUrl = img.url
    } else if (img.url && !imageUrls.includes(img.url)) {
      imageUrls.push(img.url)
    }
  }
  return { videoUrl, imageUrls }
}
