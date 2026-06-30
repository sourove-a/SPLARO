'use client'

import { useState } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import { generateAIProduct } from '@/lib/api/finance'

export function AIProductAgentPanel() {
  const [form, setForm] = useState({
    productName: '',
    fabric: '',
    color: '',
    category: '',
    price: '',
    occasion: '',
    size: '',
    stock: '',
  })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const job = await generateAIProduct(
        {
          ...form,
          price: form.price ? Number(form.price) : undefined,
          stock: form.stock ? Number(form.stock) : undefined,
        },
        'admin',
      ) as { outputData?: Record<string, unknown> }
      setResult(job.outputData ?? null)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Generation failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-[22px] border border-black/5 bg-white/60 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Upload className="h-4 w-4 text-[#5E7CFF]" />
          <h3 className="text-sm font-black">Product Input</h3>
        </div>
        {(['productName', 'fabric', 'color', 'category', 'price', 'occasion', 'size', 'stock'] as const).map(
          (field) => (
            <label key={field} className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#6B6B6B]">
                {field.replace(/([A-Z])/g, ' $1')}
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-sm font-semibold outline-none focus:border-[#5E7CFF]/50"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required={field === 'productName'}
              />
            </label>
          ),
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5E7CFF] py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? 'Generating…' : 'Generate AI Content'}
        </button>
      </form>

      <div className="rounded-[22px] border border-black/5 bg-white/55 p-5">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-[#6B6B6B]">Review & Approve</h3>
        {result ? (
          <pre className="max-h-[520px] overflow-auto rounded-xl bg-[#111111] p-4 text-[11px] leading-relaxed text-[#FAF8F5]">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p className="text-sm font-semibold text-[#6B6B6B]">
            Generated titles, SEO, Bangla/English copy, social captions, SKU, QR, and share links appear here for approval before publishing.
          </p>
        )}
      </div>
    </div>
  )
}
