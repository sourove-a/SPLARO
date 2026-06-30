import Link from 'next/link'
import { ArrowLeft, EyeOff } from 'lucide-react'

export default function CollectionNotFound() {
  return (
    <main className="shop-page-shell px-3 sm:px-5 lg:px-8">
      <section className="mx-auto flex min-h-[58vh] max-w-[720px] items-center justify-center">
        <div className="w-full rounded-[1.6rem] border border-black/8 bg-white/75 px-6 py-10 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/5 text-black/55">
            <EyeOff className="h-5 w-5" strokeWidth={2} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/45">Collection unavailable</p>
          <h1 className="mt-2 text-2xl font-black text-black">This collection is not live right now</h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-black/55">
            It may be hidden while stock is being refreshed. Browse the full catalog or explore other collections.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/shop" className="glass-action">
              Shop all products
            </Link>
            <Link href="/collections" className="glass-action">
              View collections
            </Link>
          </div>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-black/45 transition hover:text-black">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  )
}
