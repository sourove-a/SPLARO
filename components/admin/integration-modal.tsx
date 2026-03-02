'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, PlugZap, Power, Save, TestTubeDiagonal, XCircle } from 'lucide-react';
import {
  connectIntegrationAction,
  disconnectIntegrationAction,
  testIntegrationConnectionAction,
  type IntegrationView,
} from '@/app/actions/integrations';
import {
  INTEGRATION_BY_PROVIDER,
  type IntegrationMode,
  type IntegrationProvider,
} from '@/lib/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ToastViewport, type ToastMessage } from '@/components/ui/toast';

type IntegrationModalProps = {
  integration: IntegrationView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (row: IntegrationView) => void;
};

const makeToast = (tone: ToastMessage['tone'], message: string): ToastMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  tone,
  message,
});

export function IntegrationModal({ integration, open, onOpenChange, onUpdated }: IntegrationModalProps) {
  const [mode, setMode] = useState<IntegrationMode>('SANDBOX');
  const [values, setValues] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testingMessage, setTestingMessage] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const definition = integration ? INTEGRATION_BY_PROVIDER[integration.provider] : null;

  useEffect(() => {
    if (!integration || !definition) return;
    setMode(integration.mode);
    const nextValues: Record<string, string> = {};
    for (const field of definition.fields) {
      if (!field.secret) {
        nextValues[field.key] = integration.configMask[field.key] || '';
      } else {
        nextValues[field.key] = '';
      }
    }
    setValues(nextValues);
    setTestingMessage('');
  }, [integration, definition]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const canSubmit = useMemo(() => {
    if (!definition) return false;
    return definition.fields
      .filter((field) => field.required)
      .every((field) => String(values[field.key] || '').trim().length > 0);
  }, [definition, values]);

  if (!integration || !definition) return null;

  const provider = integration.provider as IntegrationProvider;

  const onValueChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const runTest = async () => {
    setIsTesting(true);
    setTestingMessage('Testing connection...');
    const result = await testIntegrationConnectionAction({ provider, mode, values });
    if (result.ok) {
      setTestingMessage(result.message);
      setToast(makeToast('success', result.message));
    } else {
      setTestingMessage(result.message);
      setToast(makeToast('error', result.message));
    }
    setIsTesting(false);
  };

  const runConnect = () => {
    startTransition(async () => {
      const result = await connectIntegrationAction({ provider, mode, values });
      if (!result.ok || !result.data) {
        setToast(makeToast('error', result.message));
        return;
      }
      onUpdated(result.data);
      setToast(makeToast('success', result.message));
      onOpenChange(false);
    });
  };

  const runDisconnect = () => {
    startTransition(async () => {
      const result = await disconnectIntegrationAction(provider);
      if (!result.ok || !result.data) {
        setToast(makeToast('error', result.message));
        return;
      }
      onUpdated(result.data);
      setToast(makeToast('info', result.message));
      onOpenChange(false);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="rounded-[28px] border border-[#e8c670]/35 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/70"
          >
            <DialogHeader>
              <DialogTitle className="text-[#f8e7bf]">{definition.name}</DialogTitle>
              <DialogDescription>{definition.description}</DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              {definition.supportsMode ? (
                <div className="rounded-2xl border border-[#3b311e] bg-[#0d0d0d] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.2em] text-[#dbc18a]">Mode</Label>
                      <p className="mt-1 text-xs text-[#a99773]">Toggle between sandbox and live credentials.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${mode === 'SANDBOX' ? 'text-[#f0ddb0]' : 'text-[#7e7054]'}`}>Sandbox</span>
                      <Switch checked={mode === 'LIVE'} onCheckedChange={(checked) => setMode(checked ? 'LIVE' : 'SANDBOX')} />
                      <span className={`text-xs font-semibold ${mode === 'LIVE' ? 'text-[#f0ddb0]' : 'text-[#7e7054]'}`}>Live</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                {definition.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.16em] text-[#cdb175]">{field.label}</Label>
                    <Input
                      value={values[field.key] || ''}
                      onChange={(event) => onValueChange(field.key, event.target.value)}
                      type={field.secret ? 'password' : 'text'}
                      autoComplete="off"
                      placeholder={field.placeholder}
                      className="h-11 border-[#4d3f25] bg-[#080808] text-[#f8eedb] placeholder:text-[#6f654f] focus-visible:border-[#e8c670] focus-visible:ring-[#e8c670]/50"
                    />
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {testingMessage ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-xl border border-[#3d3422] bg-[#111009] px-3 py-2 text-xs text-[#d8be85]"
                  >
                    {testingMessage}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <DialogFooter className="mt-6">
              <Button
                variant="outline"
                onClick={runTest}
                disabled={isTesting || isPending || !canSubmit}
                className="h-11 border-[#e8c670]/40 text-[#e8c670] hover:bg-[#e8c670]/10"
              >
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTubeDiagonal className="h-4 w-4" />}
                Test Connection
              </Button>

              {integration.isConnected ? (
                <Button
                  variant="secondary"
                  onClick={runDisconnect}
                  disabled={isPending}
                  className="h-11 border-[#a24b4b]/50 bg-[#2a1313] text-[#f2b9b9] hover:bg-[#3a1a1a]"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  Disconnect
                </Button>
              ) : null}

              <Button
                onClick={runConnect}
                disabled={isPending || !canSubmit}
                className="h-11 bg-gradient-to-r from-[#e8c670] to-[#d9ae58] text-[#171208] hover:brightness-105"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : integration.isConnected ? <Save className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
                {integration.isConnected ? 'Save Changes' : 'Connect'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending || isTesting}
                className="h-11 text-[#a99875] hover:bg-[#ffffff0d]"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      <ToastViewport toast={toast} />
    </>
  );
}
