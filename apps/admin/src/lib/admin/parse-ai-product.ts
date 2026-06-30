/** Normalize AI product job output — API may use longDescription/seoTitle aliases. */
export function parseAiProductOutput(out: Record<string, unknown>) {
  const str = (...keys: string[]) => {
    for (const k of keys) {
      const v = out[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return undefined
  }

  return {
    description: str('description', 'longDescription', 'shortDescription', 'descriptionEn'),
    descriptionBn: str('descriptionBn', 'description_bn', 'banglaDescription', 'descriptionBangla'),
    metaTitle: str('metaTitle', 'seoTitle', 'title'),
    metaDescription: str('metaDescription', 'seoMetaDescription', 'shortDescription'),
    fabric: str('fabric', 'fabricContent'),
    season: str('season'),
    occasion: str('occasion'),
    title: str('title', 'seoTitle'),
    seoTitle: str('seoTitle', 'metaTitle', 'title'),
    seoMetaDescription: str('seoMetaDescription', 'metaDescription', 'shortDescription'),
    longDescription: str('longDescription', 'description', 'shortDescription'),
  }
}

export function isAiJobFailed(job: { status?: string; errorMsg?: string | null }): boolean {
  return job.status === 'FAILED'
}
