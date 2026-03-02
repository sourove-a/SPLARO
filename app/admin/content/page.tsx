import {
  deleteStoryPostAction,
  saveHeroContentAction,
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

export default async function AdminContentPage() {
  const [hero, posts] = await Promise.all([
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
  ]);

  const orderedPosts = [...posts].sort((a, b) => +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt));

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
