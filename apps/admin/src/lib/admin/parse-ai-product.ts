/** Normalize AI product job output — API may use longDescription/seoTitle aliases. */
export function parseAiProductOutput(out: Record<string, unknown>) {
  const str = (...keys: string[]) => {
    for (const k of keys) {
      const v = out[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return undefined
  }

  /** Tags arrive as an array from the model but as a comma string in the form. */
  const list = (...keys: string[]): string[] | undefined => {
    for (const k of keys) {
      const v = out[k]
      if (Array.isArray(v)) {
        const items = v.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
        if (items.length > 0) return items.map((i) => i.trim())
      }
      if (typeof v === 'string' && v.trim()) {
        return v
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean)
      }
    }
    return undefined
  }

  return {
    description: str('description', 'longDescription', 'shortDescription', 'descriptionEn'),
    descriptionBn: str('descriptionBn', 'description_bn', 'banglaDescription', 'descriptionBangla'),
    nameBn: str('nameBn', 'name_bn', 'titleBn', 'banglaName'),
    tags: list('tags', 'keywords'),
    careInstructions: str('careInstructions', 'care', 'careInstruction'),
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
