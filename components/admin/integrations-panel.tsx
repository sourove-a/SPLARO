'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
  ShieldAlert,
  Truck,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  disconnectIntegrationAction,
  type IntegrationView,
} from '@/app/actions/integrations';
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_DEFINITIONS,
  type IntegrationCategory,
  type IntegrationProvider,
} from '@/lib/integrations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IntegrationModal } from '@/components/admin/integration-modal';
import { ToastViewport, type ToastMessage } from '@/components/ui/toast';

const iconMap: Record<IntegrationProvider, React.ComponentType<{ className?: string }>> = {
  bkash: Wallet,
  nagad: Wallet,
  sslcommerz: CreditCard,
  rocket: Wallet,
  pathao: Truck,
  steadfast: Truck,
  meta: BarChart3,
};

const badgeClass = (connected: boolean): string =>
  connected
    ? 'border-[#3e7a57] bg-[#123023] text-[#a5e8c3]'
    : 'border-[#6f5931] bg-[#1d1609] text-[#f2d08d]';

const makeToast = (tone: ToastMessage['tone'], message: string): ToastMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  tone,
  message,
});

type IntegrationsPanelProps = {
  initialRows: IntegrationView[];
};

export function IntegrationsPanel({ initialRows }: IntegrationsPanelProps) {
  const [rows, setRows] = useState<IntegrationView[]>(initialRows);
  const [modalProvider, setModalProvider] = useState<IntegrationProvider | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedIntegration = useMemo(
    () => (modalProvider ? rows.find((row) => row.provider === modalProvider) || null : null),
    [modalProvider, rows],
  );

  const grouped = useMemo(() => {
    const map = new Map<IntegrationCategory, IntegrationView[]>();
    for (const category of INTEGRATION_CATEGORIES) {
      map.set(category, []);
    }

    for (const definition of INTEGRATION_DEFINITIONS) {
      const found = rows.find((row) => row.provider === definition.provider);
      if (!found) continue;
      const bucket = map.get(definition.category);
      if (bucket) bucket.push(found);
    }

    return map;
  }, [rows]);

  const updateRow = (next: IntegrationView) => {
    setRows((prev) => prev.map((row) => (row.provider === next.provider ? next : row)));
  };

  const disconnect = (provider: IntegrationProvider) => {
    startTransition(async () => {
      const result = await disconnectIntegrationAction(provider);
      if (!result.ok || !result.data) {
        setToast(makeToast('error', result.message));
        return;
      }
      updateRow(result.data);
      setToast(makeToast('info', result.message));
    });
  };

  return (
    <div className="space-y-6">
      <section className="admin-panel-card p-6 md:p-8">
        <p className="admin-kicker">Integrations Console</p>
        <h2 className="admin-heading mt-2 text-[#f6e7c4]">Premium Integration Control</h2>
        <p className="mt-3 max-w-3xl text-sm text-[#a89774]">
          Configure payment gateways, courier services and marketing channels from one secure panel. Credentials are encrypted
          at rest and every change is audited.
        </p>
      </section>

      {INTEGRATION_CATEGORIES.map((category) => (
        <section key={category} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-[#e8c670]">{category}</h3>
            <div className="rounded-full border border-[#47381d] bg-[#0f0d08] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#bda46d]">
              {grouped.get(category)?.length || 0} providers
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(grouped.get(category) || []).map((integration) => {
              const Icon = iconMap[integration.provider] || ShieldAlert;
              const isMeta = integration.provider === 'meta';
              return (
                <motion.div
                  key={integration.provider}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="h-full"
                >
                  <Card className="admin-integration-card h-full border-[#3a2f1a] bg-[#0a0f0a]/95 shadow-xl shadow-black/45">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#574724] bg-[#100c05] text-[#e8c670]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${badgeClass(integration.isConnected)}`}>
                          {integration.isConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                          {integration.isConnected ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-[#f5e8cb]">{integration.name}</CardTitle>
                        <CardDescription className="mt-1 text-[#9f8d69]">{integration.description}</CardDescription>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="rounded-xl border border-[#342912] bg-[#0f0c07] p-3 text-xs text-[#ae9b73]">
                        <p className="uppercase tracking-[0.14em] text-[#8f7d58]">Last Test</p>
                        <p className="mt-1 font-medium text-[#dcc390]">{integration.lastTestMessage || 'No test executed yet.'}</p>
                        <p className="mt-1 text-[11px] text-[#7e6f53]">{new Date(integration.updatedAt).toLocaleString()}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!integration.isConnected ? (
                          <Button
                            onClick={() => setModalProvider(integration.provider)}
                            className="h-11 flex-1 min-w-[160px] bg-gradient-to-r from-[#e8c670] to-[#d7a84f] text-[#1d1607]"
                          >
                            Connect
                          </Button>
                        ) : isMeta ? (
                          <Button
                            onClick={() => setModalProvider(integration.provider)}
                            className="h-11 flex-1 min-w-[160px] bg-gradient-to-r from-[#e8c670] to-[#d7a84f] text-[#1d1607]"
                          >
                            Manage
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => disconnect(integration.provider)}
                              disabled={isPending}
                              variant="outline"
                              className="h-11 flex-1 min-w-[120px] border-[#9f5555]/50 text-[#e7b3b3] hover:bg-[#301616]"
                            >
                              {isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : null}
                              Disconnect
                            </Button>
                            <Button
                              onClick={() => setModalProvider(integration.provider)}
                              variant="secondary"
                              className="h-11 flex-1 min-w-[120px] border-[#e8c670]/35 bg-[#e8c670]/10 text-[#e8c670]"
                            >
                              Manage
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}

      <IntegrationModal
        open={Boolean(modalProvider)}
        integration={selectedIntegration}
        onOpenChange={(open) => {
          if (!open) setModalProvider(null);
        }}
        onUpdated={(row) => {
          updateRow(row);
        }}
      />

      <ToastViewport toast={toast} />
    </div>
  );
}
