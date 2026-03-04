import {
  moderateReviewAction,
  saveReviewSettingsAction,
  seedReviewAction,
} from '@/app/admin/module-actions';
import { readAdminSetting } from '@/app/admin/_lib/settings-store';

type ReviewQueueRow = {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
};

type ReviewSettings = {
  autoPublishVerified: boolean;
  requireModeration: boolean;
  profanityFilter: boolean;
  minRatingToHighlight: number;
};

export default async function AdminReviewsRatingsPage() {
  const [queue, settings] = await Promise.all([
    readAdminSetting<ReviewQueueRow[]>('reviews_moderation_queue', []),
    readAdminSetting<ReviewSettings>('reviews_settings', {
      autoPublishVerified: false,
      requireModeration: true,
      profanityFilter: true,
      minRatingToHighlight: 4,
    }),
  ]);

  const ordered = [...queue].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const pending = ordered.filter((item) => item.status === 'PENDING').length;
  const approved = ordered.filter((item) => item.status === 'APPROVED').length;
  const rejected = ordered.filter((item) => item.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Reviews & Ratings</p>
        <h2 className="admin-heading mt-2 text-[#f6e8ca]">Moderation Console</h2>
        <p className="mt-3 max-w-3xl text-sm text-[#9d927c]">
          Moderate product sentiment with a controlled queue. Approved reviews can be highlighted on storefront automatically.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#3d311d] bg-[#120f0a] p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#978a6f]">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-[#f3e5c2]">{pending}</p>
          </div>
          <div className="rounded-xl border border-[#2f6649] bg-[#102618] p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#84c9a0]">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-[#b6efcf]">{approved}</p>
          </div>
          <div className="rounded-xl border border-[#7a3535] bg-[#2a1111] p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#d79898]">Rejected</p>
            <p className="mt-2 text-2xl font-semibold text-[#f2c3c3]">{rejected}</p>
          </div>
        </div>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Queue Settings</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Moderation Rules</h3>
        <form action={saveReviewSettingsAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 py-2 text-sm text-[#ccb989]">
            <input type="checkbox" name="autoPublishVerified" defaultChecked={Boolean(settings.autoPublishVerified)} className="h-4 w-4" />
            Auto publish verified-buyer reviews
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 py-2 text-sm text-[#ccb989]">
            <input type="checkbox" name="requireModeration" defaultChecked={Boolean(settings.requireModeration)} className="h-4 w-4" />
            Require moderation before publish
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#3a2f1b] bg-[#0f0d08] px-3 py-2 text-sm text-[#ccb989]">
            <input type="checkbox" name="profanityFilter" defaultChecked={Boolean(settings.profanityFilter)} className="h-4 w-4" />
            Enable profanity filter
          </label>
          <input
            className="admin-input"
            name="minRatingToHighlight"
            type="number"
            min={1}
            max={5}
            defaultValue={settings.minRatingToHighlight || 4}
            placeholder="Highlight rating threshold"
          />
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Save Review Settings
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-6">
        <p className="admin-kicker">Seed Review</p>
        <h3 className="admin-heading mt-2 text-xl text-[#f3e5c2]">Add to Moderation Queue</h3>
        <form action={seedReviewAction} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="admin-input" name="productName" placeholder="Product name" required />
          <input className="admin-input" name="customerName" placeholder="Customer name" required />
          <input className="admin-input" name="rating" type="number" min={1} max={5} defaultValue={5} />
          <input className="admin-input" name="comment" placeholder="Comment" required />
          <button type="submit" className="admin-button admin-button-primary justify-center md:col-span-2 xl:col-span-4">
            Push to Queue
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <div className="mb-4">
          <p className="admin-kicker">Moderation Queue</p>
          <h3 className="text-lg font-semibold text-[#f3e5c2]">Pending + Reviewed Feedback</h3>
        </div>

        <div className="overflow-auto rounded-xl border border-[#342a17]">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Product</th>
                <th className="px-3 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Rating</th>
                <th className="px-3 py-3 text-left">Comment</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((item) => (
                <tr key={item.id} className="border-t border-[#2a2317]">
                  <td className="px-3 py-3 text-[#e7d8b8]">{item.productName}</td>
                  <td className="px-3 py-3 text-[#d6c29b]">{item.customerName}</td>
                  <td className="px-3 py-3 text-[#c5b08a]">{item.rating}/5</td>
                  <td className="px-3 py-3 text-[#baa67e] max-w-[340px]">{item.comment}</td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        item.status === 'APPROVED'
                          ? 'admin-status-ok rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'
                          : item.status === 'REJECTED'
                            ? 'admin-status-down rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'
                            : 'admin-status-warn rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={moderateReviewAction}>
                        <input type="hidden" name="reviewId" value={item.id} />
                        <input type="hidden" name="status" value="APPROVED" />
                        <button type="submit" className="admin-button admin-button-secondary">Approve</button>
                      </form>
                      <form action={moderateReviewAction}>
                        <input type="hidden" name="reviewId" value={item.id} />
                        <input type="hidden" name="status" value="REJECTED" />
                        <button type="submit" className="admin-button admin-button-secondary">Reject</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {ordered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#8c8069]">
                    Review queue is empty.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
