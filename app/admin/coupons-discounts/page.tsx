import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminCouponsDiscountsPage() {
  return (
    <ModuleBlueprint
      title="Coupons & Discounts"
      subtitle="Promotion engine for fixed/percent, scheduling, constraints, and campaign-level automation."
      features={[
        { title: 'Coupon CRUD API', status: 'done', description: 'Create/update/list coupons via existing /api/admin/coupons endpoints.' },
        { title: 'Rule Builder', status: 'planned', description: 'Cart subtotal, item category, customer segment and first-order conditions.' },
        { title: 'Auto Apply Campaigns', status: 'planned', description: 'Automatic discount by URL, UTM or customer segment triggers.' },
        { title: 'Usage Caps', status: 'planned', description: 'Per-user, per-coupon, per-day, and global redemption controls.' },
      ]}
    />
  );
}
