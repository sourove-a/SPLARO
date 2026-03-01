import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminReviewsRatingsPage() {
  return (
    <ModuleBlueprint
      title="Reviews & Ratings"
      subtitle="Moderation-first review workflow with anti-spam and verification for delivered orders."
      features={[
        { title: 'Review Queue', status: 'planned', description: 'Pending/approved/rejected moderation inbox with bulk actions.' },
        { title: 'Verified Buyer Badge', status: 'planned', description: 'Eligibility based on delivered/completed order state.' },
        { title: 'Product Sentiment Overview', status: 'planned', description: 'Rating trend, issue tags and escalation insights.' },
        { title: 'Public Reply Controls', status: 'planned', description: 'Brand response panel with SLA indicators.' },
      ]}
    />
  );
}
