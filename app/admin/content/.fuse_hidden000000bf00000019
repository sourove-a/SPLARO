import {
  deleteHeroSlideAction,
  moveHeroSlideAction,
  deleteStoryPostAction,
  saveHeroContentAction,
  saveHeroSlideAction,
  saveStoryPostAction,
} from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';

type HeroSettings = {
  title: string;
  subtitle: string;
  badge: string;
  ctaLabel: string;
  ctaUrl: string;
  alignment: string;
  maxLines: number;
  autoBalance: boolean;
};

type StoryPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  published: boolean;
  publishAt?: string;
  createdAt: string;
  updatedAt: string;
};

type HeroSlide = {
  id: string;
  img: string;
  title: string;
  subtitle: string;
  tag: string;
  linkUrl?: string;
};

export default async function AdminContentPage() {
  const [hero, posts, slides] = await Promise.all([
    readAdminSetting<HeroSettings>('hero_content_settings', {
      title: 'Luxury in Motion',
      subtitle: 'Premium footwear and bags with clean lines and elevated finish.',
      badge: 'New Season',
      ctaLabel: 'Enter the Shop',
      ctaUrl: '/shop',
      alignment: 'LEFT',
      maxLines: 2,
      autoBalance: true,
    }),
    readAdminSetting<StoryPost[]>('story_posts', []),
    readAdminSetting<HeroSlide[]>('hero_slides', []),
  ]);

  const orderedPosts = [...posts].sort((a, b) => +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt));
  const orderedSlides = [...(Array.isArray(slides) ? slides : [])].filter((slide) => String(slide?.img || '').trim() !== '');

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Content</p>
        <h2 className="admin-heading mt-2 text-[#f6e8ca]">Hero & Story CMS</h2>
        <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
          Manage storefront headline, badge, CTA and story feed with a clean draft/publish workflow.
        </p>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Hero Section</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Homepage Hero Controls</h3>
        <form action={saveHeroContentAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-input md:col-span-2" name="title" defaultValue={hero.title || ''} placeholder="Hero title" />
          <input className="admin-input" name="badge" defaultValue={hero.badge || ''} placeholder="Badge text" />
          <select className="admin-select" name="alignment" defaultValue={hero.alignment || 'LEFT'}>
            <option value="LEFT">Left aligned</option>
            <option value="CENTER">Center aligned</option>
          </select>
          <input className="admin-input md:col-span-2" name="subtitle" defaultValue={hero.subtitle || ''} placeholder="Hero subtitle" />
          <input className="admin-input" name="ctaLabel" defaultValue={hero.ctaLabel || ''} placeholder="CTA label" />
          <input className="admin-input" name="ctaUrl" defaultValue={hero.ctaUrl || ''} placeholder="CTA URL" />
          <input className="admin-input" type="number" min={1} max={3} name="maxLines" defaultValue={hero.maxLines || 2} />
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input type="checkbox" name="autoBalance" defaultChecked={Boolean(hero.autoBalance)} className="h-4 w-4" />
            Auto balance headline wrap
          </label>
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Save Hero Content
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Hero Slider</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Manual Slide Manager</h3>
        <p className="mt-2 text-sm text-[#9d927c]">
          Add slider image manually by URL (Cloudinary/direct CDN link), then set title, subtitle, tag and optional link.
        </p>
        <div className="mt-3 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-4 py-3 text-xs text-[#c7b185]">
          Recommended image size: <span className="font-semibold text-[#f2e2bf]">1920x900</span>. Use direct image URL
          (for example Cloudinary secure URL) for the fastest load.
        </div>

        <form action={saveHeroSlideAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="index" value="-1" />
          <input className="admin-input md:col-span-2 xl:col-span-4" name="img" placeholder="Image URL (https://...)" required />
          <input className="admin-input" name="title" placeholder="Slide title" required />
          <input className="admin-input" name="subtitle" placeholder="Slide subtitle" />
          <input className="admin-input" name="tag" placeholder="Tag (e.g. NEW)" />
          <input className="admin-input" name="linkUrl" placeholder="Slide link URL (/shop or https://...)" />
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Add Slide
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {orderedSlides.map((slide, index) => (
            <article key={slide.id || `${slide.img}-${index}`} className="rounded-2xl border border-[#342a17] bg-[#0e0c09] p-4">
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="overflow-hidden rounded-xl border border-[#2f2618] bg-[#090806]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.img} alt={slide.title || `Slide ${index + 1}`} className="h-36 w-full object-cover" />
                </div>

                <div className="space-y-3">
                  <form action={saveHeroSlideAction} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="index" value={index} />
                    <input type="hidden" name="id" value={slide.id || ''} />
                    <input className="admin-input md:col-span-2" name="img" defaultValue={slide.img || ''} placeholder="Image URL" required />
                    <input className="admin-input" name="title" defaultValue={slide.title || ''} placeholder="Title" required />
                    <input className="admin-input" name="subtitle" defaultValue={slide.subtitle || ''} placeholder="Subtitle" />
                    <input className="admin-input" name="tag" defaultValue={slide.tag || ''} placeholder="Tag" />
                    <input className="admin-input" name="linkUrl" defaultValue={slide.linkUrl || ''} placeholder="Slide link URL" />
                    <button type="submit" className="admin-button admin-button-secondary md:col-span-2">Update Slide</button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    <form action={moveHeroSlideAction}>
                      <input type="hidden" name="index" value={index} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" className="admin-button admin-button-secondary" disabled={index === 0}>Move Up</button>
                    </form>
                    <form action={moveHeroSlideAction}>
                      <input type="hidden" name="index" value={index} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" className="admin-button admin-button-secondary" disabled={index === orderedSlides.length - 1}>Move Down</button>
                    </form>
                    <a
                      href={slide.img}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-button admin-button-secondary"
                    >
                      Open Image
                    </a>
                    <form action={deleteHeroSlideAction}>
                      <input type="hidden" name="id" value={slide.id || ''} />
                      <button type="submit" className="admin-button admin-button-secondary">Delete</button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {orderedSlides.length === 0 ? (
            <div className="rounded-xl border border-[#342a17] bg-[#0e0c09] px-4 py-10 text-center text-[#8c8069]">
              No slider image added yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Story Posts</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Create Story / CMS Post</h3>
        <form action={saveStoryPostAction} className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="admin-input" name="title" placeholder="Story title" required />
          <input className="admin-input" name="imageUrl" placeholder="Image URL" />
          <input className="admin-input md:col-span-2" name="excerpt" placeholder="Short excerpt" />
          <textarea className="admin-textarea md:col-span-2 min-h-[120px]" name="body" placeholder="Story body (supports markdown/plain text)" />
          <input className="admin-input" type="datetime-local" name="publishAt" />
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
            <input type="checkbox" name="published" className="h-4 w-4" />
            Publish now
          </label>
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2">
            Save Story Post
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4">
          <p className="admin-kicker">Published + Draft</p>
          <h3 className="text-lg font-semibold text-[#f3e5c2]">Story Library</h3>
        </div>

        <div className="space-y-3">
          {orderedPosts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-[#342a17] bg-[#0e0c09] p-4">
              <form action={saveStoryPostAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={post.id} />
                <input className="admin-input" name="title" defaultValue={post.title || ''} placeholder="Title" required />
                <input className="admin-input" name="imageUrl" defaultValue={post.imageUrl || ''} placeholder="Image URL" />
                <input className="admin-input md:col-span-2" name="excerpt" defaultValue={post.excerpt || ''} placeholder="Excerpt" />
                <textarea className="admin-textarea md:col-span-2 min-h-[96px]" name="body" defaultValue={post.body || ''} />
                <input
                  className="admin-input"
                  type="datetime-local"
                  name="publishAt"
                  defaultValue={post.publishAt ? new Date(post.publishAt).toISOString().slice(0, 16) : ''}
                />
                <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 text-sm text-[#ccb989]">
                  <input type="checkbox" name="published" defaultChecked={Boolean(post.published)} className="h-4 w-4" />
                  Published
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <button type="submit" className="admin-button admin-button-secondary">Update</button>
                  <span className="text-xs text-[#8f826a]">
                    Updated {post.updatedAt ? new Date(post.updatedAt).toLocaleString() : '-'}
                  </span>
                </div>
              </form>
              <form action={deleteStoryPostAction} className="mt-2">
                <input type="hidden" name="id" value={post.id} />
                <button type="submit" className="admin-button admin-button-secondary">Delete</button>
              </form>
            </article>
          ))}
          {orderedPosts.length === 0 ? (
            <div className="rounded-xl border border-[#342a17] bg-[#0e0c09] px-4 py-10 text-center text-[#8c8069]">
              No story posts yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
