import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminSettingsPage() {
  return (
    <ModuleBlueprint
      title="Platform Settings"
      subtitle="Global operational settings for commerce, finance, localization and storefront styling."
      features={[
        { title: 'Settings API', status: 'done', description: 'General shipping/tax/store settings already persisted via admin API.' },
        { title: 'Tax Matrix', status: 'planned', description: 'Region/category-level tax tables and exemptions.' },
        { title: 'Currency + Locale', status: 'planned', description: 'Multi-currency formatting and locale presets.' },
        { title: 'Appearance Tokens', status: 'planned', description: 'Brand-safe theme variables for storefront/admin.' },
      ]}
    />
  );
}
