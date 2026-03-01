import { CheckCircle2, CircleDashed } from 'lucide-react';

type FeatureItem = {
  title: string;
  status: 'done' | 'planned';
  description: string;
};

export function ModuleBlueprint({
  title,
  subtitle,
  features,
}: {
  title: string;
  subtitle: string;
  features: FeatureItem[];
}) {
  return (
    <section className="space-y-6">
      <div className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Module Blueprint</p>
        <h2 className="admin-heading mt-2 text-[#f7edd7]">{title}</h2>
        <p className="mt-3 text-sm text-[#9f947f] max-w-3xl">{subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => {
          const done = feature.status === 'done';
          return (
            <article key={feature.title} className="admin-panel-card p-5">
              <div className="flex items-start gap-3">
                <span className={done ? 'admin-status-ok rounded-full p-1.5' : 'admin-status-warn rounded-full p-1.5'}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                </span>
                <div>
                  <h3 className="text-sm uppercase tracking-[0.12em] text-[#f3e5c2] font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-[#9d927f]">{feature.description}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
