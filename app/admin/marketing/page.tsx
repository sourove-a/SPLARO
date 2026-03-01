import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminMarketingPage() {
  return (
    <ModuleBlueprint
      title="Marketing Operations"
      subtitle="Campaign automation, attribution and growth diagnostics from one premium control surface."
      features={[
        { title: 'Campaign CRUD + Send APIs', status: 'done', description: 'Campaign management already exists in admin API namespace.' },
        { title: 'Meta + GA4 Attribution', status: 'planned', description: 'Cross-channel funnel reporting and ROAS comparisons.' },
        { title: 'Email Journey Builder', status: 'planned', description: 'Welcome, abandoned cart, win-back and post-purchase flows.' },
        { title: 'SEO Toolkit', status: 'planned', description: 'Meta automation, sitemap controls and technical SEO checks.' },
      ]}
    />
  );
}
