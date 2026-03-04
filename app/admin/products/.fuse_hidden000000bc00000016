import { createProductAction, updateProductAction, archiveProductAction } from '../actions';
import { listAdminProducts } from '../_lib/data';

const money = (value: number): string =>
  new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(value || 0);

const pick = (value: string | string[] | undefined, fallback = ''): string => {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = pick(params.q);
  const category = pick(params.category);
  const type = pick(params.type);
  const page = Number(pick(params.page, '1')) || 1;

  const result = await listAdminProducts({
    q,
    category,
    type,
    page,
    pageSize: 16,
  });

  const prevPage = Math.max(1, result.page - 1);
  const nextPage = Math.min(result.totalPages, result.page + 1);

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="admin-kicker">Catalog Management</p>
            <h2 className="admin-heading mt-2 text-[#f5e8cb]">Products</h2>
            <p className="mt-3 text-sm text-[#9c917c] max-w-3xl">
              Full WooCommerce-style catalog control with SKU lifecycle, stock governance, price editing and structured import/export.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/reports?type=products" className="admin-button admin-button-secondary">Export Product Report</a>
            <a href="/api/admin/products/bulk-import" className="admin-button admin-button-secondary">Bulk Import Endpoint</a>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#3e311d] bg-[#0e0c09] px-4 py-3 text-xs text-[#c9b58f]">
          Quick guide: Add product name, type, price, stock and image URL. Slug supports
          <span className="ml-1 font-semibold text-[#f0dfba]">letters, numbers, -, _, . and ~</span>.
        </div>

        <form action={createProductAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Product Name</span>
            <input name="name" required placeholder="e.g. Adidas Ultra Boost" className="admin-input" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Custom Slug (Optional)</span>
            <input name="slug" placeholder="best-nike-shoes বা new-arrival-2026" className="admin-input" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Category</span>
            <input name="category_id" placeholder="e.g. sneakers / handbags" className="admin-input" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Product Type</span>
            <select name="product_type" defaultValue="shoe" className="admin-select">
              <option value="shoe">Shoe</option>
              <option value="bag">Bag</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Price (BDT)</span>
            <input name="price" type="number" min={0} step="1" required placeholder="18500" className="admin-input" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Discount Price</span>
            <input name="discount_price" type="number" min={0} step="1" placeholder="17000 (optional)" className="admin-input" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Stock Quantity</span>
            <input name="stock_quantity" type="number" min={0} step="1" placeholder="50" className="admin-input" />
          </label>
          <label className="flex items-end gap-2 rounded-xl border border-[#3e311d] bg-[#0e0c09] px-3 py-3 text-sm text-[#c8b48e]">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4" /> Publish immediately
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Main Image URL</span>
            <input name="image_url" placeholder="https://res.cloudinary.com/.../image.webp" className="admin-input" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#9f8d68]">Product URL (Optional)</span>
            <input name="product_url" placeholder="/product/adidas/sneakers/ultra-boost অথবা full URL" className="admin-input" />
          </label>

          <button type="submit" className="admin-button admin-button-primary md:col-span-2 xl:col-span-4 justify-center">
            Create Product
          </button>
        </form>
      </section>

      <section className="admin-panel-card p-5 md:p-6">
        <form className="grid gap-3 md:grid-cols-4" method="GET">
          <input name="q" defaultValue={q} placeholder="Search by name/slug" className="admin-input md:col-span-2" />
          <input name="category" defaultValue={category} placeholder="Category" className="admin-input" />
          <select name="type" defaultValue={type} className="admin-select">
            <option value="">All Types</option>
            <option value="shoe">Shoe</option>
            <option value="bag">Bag</option>
          </select>
          <button type="submit" className="admin-button admin-button-secondary md:col-span-4 justify-center">Apply Filters</button>
        </form>

        <div className="mt-5 overflow-auto rounded-xl border border-[#342a17]">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-[#110f0c] text-[#958667] text-[10px] uppercase tracking-[0.22em]">
              <tr>
                <th className="px-3 py-3 text-left">Product</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-left">Pricing & Stock</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((product) => (
                <tr key={product.id} className="border-t border-[#2a2317] align-top">
                  <td className="px-3 py-3 text-[#f0e4cb]">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-[#8d8069] mt-1">/{product.slug}</p>
                  </td>
                  <td className="px-3 py-3 text-[#ddcb9f] uppercase text-xs tracking-[0.16em]">{product.product_type}</td>
                  <td className="px-3 py-3 text-[#c6b691]">{product.category_id || '-'}</td>
                  <td className="px-3 py-3 text-[#d9c7a0]">
                    <p className="font-semibold">{money(product.price)}</p>
                    <p className="text-xs text-[#8f836d]">Stock: {product.stock_quantity}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={product.active ? 'admin-status-ok rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]' : 'admin-status-down rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]'}>
                      {product.active ? 'Published' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <form action={updateProductAction} className="grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="id" value={product.id} />
                      <input name="price" type="number" min={0} step="1" defaultValue={product.price} className="admin-input" />
                      <input name="stock_quantity" type="number" min={0} step="1" defaultValue={product.stock_quantity} className="admin-input" />
                      <label className="flex items-center gap-2 rounded-lg border border-[#3e311d] bg-[#0e0c09] px-3 py-2 text-xs text-[#c8b48e] md:col-span-2">
                        <input type="checkbox" name="active" defaultChecked={product.active} className="h-4 w-4" /> Active listing
                      </label>
                      <button type="submit" className="admin-button admin-button-secondary md:col-span-2 justify-center">Save</button>
                    </form>

                    <form action={archiveProductAction} className="mt-2">
                      <input type="hidden" name="id" value={product.id} />
                      <button type="submit" className="admin-button admin-button-secondary w-full justify-center">Archive</button>
                    </form>
                  </td>
                </tr>
              ))}
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#8d816d]">No products matched your filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-[#9b8f79]">
          <p>
            Showing page {result.page} of {result.totalPages} • {result.total} products • storage: {result.storage}
          </p>
          <div className="flex items-center gap-2">
            <a
              className="admin-button admin-button-secondary"
              href={`?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}&page=${prevPage}`}
            >
              Previous
            </a>
            <a
              className="admin-button admin-button-secondary"
              href={`?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}&page=${nextPage}`}
            >
              Next
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
