import { ModuleBlueprint } from '@/components/admin/module-blueprint';

export default function AdminContentPage() {
  return (
    <ModuleBlueprint
      title="Content Studio"
      subtitle="Hero, story and static pages with revision history and polished draft/publish workflow."
      features={[
        { title: 'Hero Slider Management', status: 'done', description: 'Existing admin has hero/cms controls integrated.' },
        { title: 'Story/CMS API', status: 'done', description: 'Story settings are available through /api/admin/story.' },
        { title: 'Blog Authoring', status: 'planned', description: 'Rich text posts, taxonomy, SEO and publication scheduling.' },
        { title: 'Preview & Revision Restore', status: 'planned', description: 'Compare revisions and restore with audit trail.' },
      ]}
    />
  );
}
