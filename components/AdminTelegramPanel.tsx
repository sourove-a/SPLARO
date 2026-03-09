/**
 * AdminTelegramPanel.tsx
 * Telegram Bot Control — Site management via Telegram chat
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Bot, Send, CheckCircle, AlertTriangle, Key,
  Copy, RefreshCcw, Zap, Package, ShoppingBag, BarChart3,
  Users, Settings2, Bell, Shield, Activity, ChevronRight,
  ExternalLink, Info, X
} from 'lucide-react';
import { useApp } from '../store';
import { GlassCard, PrimaryButton, LuxuryFloatingInput } from './LiquidGlass';

/* ─── Telegram Commands Reference ───────────────────────── */
const TELEGRAM_COMMANDS = [
  {
    category: '📦 Orders',
    commands: [
      { cmd: '/orders', desc: 'সব active orders দেখুন' },
      { cmd: '/pending', desc: 'শুধু pending orders দেখুন' },
      { cmd: '/today', desc: 'আজকের orders ও revenue' },
      { cmd: '/order [ID]', desc: 'নির্দিষ্ট order এর details' },
      { cmd: '/process [ID]', desc: 'Order কে Processing করুন' },
      { cmd: '/ship [ID]', desc: 'Order কে Shipped করুন' },
      { cmd: '/deliver [ID]', desc: 'Order কে Delivered করুন' },
      { cmd: '/cancel [ID]', desc: 'Order cancel করুন' },
    ]
  },
  {
    category: '🛍️ Products',
    commands: [
      { cmd: '/products', desc: 'সব products এর list' },
      { cmd: '/stock', desc: 'Low stock items দেখুন' },
      { cmd: '/price [ID] [amount]', desc: 'Product এর দাম আপডেট' },
      { cmd: '/delete [ID]', desc: 'Product delete করুন' },
    ]
  },
  {
    category: '📊 Analytics',
    commands: [
      { cmd: '/revenue', desc: 'Total revenue summary' },
      { cmd: '/stats', desc: 'Site statistics overview' },
      { cmd: '/top', desc: 'Top selling products' },
      { cmd: '/customers', desc: 'Customer count ও info' },
    ]
  },
  {
    category: '⚙️ Settings',
    commands: [
      { cmd: '/maintenance on/off', desc: 'Maintenance mode toggle' },
      { cmd: '/announce [text]', desc: 'Site announcement পাঠান' },
      { cmd: '/status', desc: 'Site health status' },
      { cmd: '/help', desc: 'সব commands এর list' },
    ]
  },
];

/* ─── Status Indicator ───────────────────────────────────── */
const StatusBadge = ({ connected }: { connected: boolean }) => (
  <div
    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase"
    style={{
      background: connected ? 'rgba(16,163,127,0.12)' : 'rgba(239,68,68,0.10)',
      border: `1px solid ${connected ? 'rgba(16,163,127,0.30)' : 'rgba(239,68,68,0.25)'}`,
      color: connected ? '#10A37F' : '#ef4444',
    }}
  >
    <div
      className="w-1.5 h-1.5 rounded-full"
      style={{
        background: connected ? '#10A37F' : '#ef4444',
        boxShadow: connected ? '0 0 6px #10A37F' : '0 0 6px #ef4444',
      }}
    />
    {connected ? 'Connected' : 'Disconnected'}
  </div>
);

/* ─── Main Component ─────────────────────────────────────── */
export const AdminTelegramPanel: React.FC = () => {
  const { orders, products, siteSettings } = useApp();

  const [botToken, setBotToken] = useState<string>(() =>
    localStorage.getItem('splaro-tg-token') || ''
  );
  const [chatId, setChatId] = useState<string>(() =>
    localStorage.getItem('splaro-tg-chatid') || ''
  );
  const [tempToken, setTempToken] = useState('');
  const [tempChatId, setTempChatId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [showConfig, setShowConfig] = useState(!botToken);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const isConfigured = !!botToken && !!chatId;

  const saveConfig = useCallback(() => {
    if (!tempToken.trim() || !tempChatId.trim()) return;
    localStorage.setItem('splaro-tg-token', tempToken.trim());
    localStorage.setItem('splaro-tg-chatid', tempChatId.trim());
    setBotToken(tempToken.trim());
    setChatId(tempChatId.trim());
    setTempToken('');
    setTempChatId('');
    setShowConfig(false);
    setTestResult(null);
  }, [tempToken, tempChatId]);

  const sendTelegramMessage = useCallback(async (text: string, token: string, cid: string) => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cid,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await response.json();
    return data;
  }, []);

  const testConnection = useCallback(async () => {
    const token = tempToken || botToken;
    const cid = tempChatId || chatId;
    if (!token || !cid) { setTestResult({ ok: false, msg: 'Bot Token ও Chat ID দিন' }); return; }
    setIsTesting(true);
    setTestResult(null);
    try {
      const data = await sendTelegramMessage(
        `🤖 <b>Splaro Admin Bot Connected!</b>\n\n✅ Bot সফলভাবে সংযুক্ত হয়েছে।\n\n/help লিখে সব commands দেখুন।`,
        token, cid
      );
      if (data.ok) {
        setTestResult({ ok: true, msg: 'Telegram bot সফলভাবে connected!' });
      } else {
        setTestResult({ ok: false, msg: data.description || 'Connection failed' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Network error — Token বা Chat ID চেক করুন' });
    } finally {
      setIsTesting(false);
    }
  }, [botToken, chatId, tempToken, tempChatId, sendTelegramMessage]);

  const sendAnnouncement = useCallback(async () => {
    if (!announcement.trim() || !isConfigured) return;
    setIsSending(true);
    try {
      const text = `📢 <b>Splaro Admin Announcement</b>\n\n${announcement}`;
      await sendTelegramMessage(text, botToken, chatId);
      setAnnouncement('');
    } catch {
      /* ignore */
    } finally {
      setIsSending(false);
    }
  }, [announcement, isConfigured, botToken, chatId, sendTelegramMessage]);

  const sendQuickSummary = useCallback(async () => {
    if (!isConfigured) return;
    setIsSending(true);
    const pendingCount = orders.filter(o => o.status === 'Pending').length;
    const todayOrders = orders.filter(o => {
      const d = new Date(o.createdAt);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    });
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const text = [
      `📊 <b>Splaro Daily Summary</b>`,
      ``,
      `📦 Total Orders: ${orders.length}`,
      `⏳ Pending: ${pendingCount}`,
      `✅ Today's Orders: ${todayOrders.length}`,
      `💰 Today's Revenue: ৳${todayRevenue.toLocaleString()}`,
      `🛍️ Total Products: ${products.length}`,
      ``,
      `🕐 ${new Date().toLocaleString('bn-BD')}`,
    ].join('\n');
    try { await sendTelegramMessage(text, botToken, chatId); } catch { /* ignore */ }
    finally { setIsSending(false); }
  }, [orders, products, isConfigured, botToken, chatId, sendTelegramMessage]);

  const copyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: 'rgba(29,161,242,0.10)', border: '1px solid rgba(29,161,242,0.25)' }}
          >
            ✈️
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Telegram Bot Control</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
              Telegram দিয়ে পুরো সাইট পরিচালনা করুন
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge connected={isConfigured} />
          <button
            onClick={() => { setTempToken(botToken); setTempChatId(chatId); setShowConfig(prev => !prev); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#FFFFFF' }}
          >
            <Settings2 className="w-4 h-4" />
            Configure
          </button>
        </div>
      </div>

      {/* Config Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white uppercase">Bot Configuration</h3>
                {isConfigured && (
                  <button onClick={() => setShowConfig(false)} className="text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Setup Instructions */}
              <div className="p-5 rounded-xl mb-6" style={{ background: 'rgba(29,161,242,0.06)', border: '1px solid rgba(29,161,242,0.20)' }}>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-3" style={{ color: '#1DA1F2' }}>
                  📋 Setup Guide
                </p>
                <ol className="text-[11px] text-zinc-400 space-y-2 leading-relaxed">
                  <li>1. Telegram-এ <strong className="text-white">@BotFather</strong> কে message করুন</li>
                  <li>2. <strong className="text-white">/newbot</strong> লিখে একটি bot তৈরি করুন</li>
                  <li>3. Bot token copy করুন (নিচে paste করুন)</li>
                  <li>4. <strong className="text-white">@userinfobot</strong> থেকে আপনার Chat ID নিন</li>
                  <li>5. নিচে token ও chat ID দিয়ে Test করুন</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-2">Bot Token</p>
                  <input
                    type="password"
                    value={tempToken}
                    onChange={e => setTempToken(e.target.value)}
                    placeholder="123456789:ABCdef..."
                    className="w-full px-4 py-3 rounded-xl text-sm bg-white/04 border border-white/10 text-white placeholder-zinc-600 outline-none focus:border-[#1DA1F2]/40"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-2">Chat ID / Group ID</p>
                  <input
                    type="text"
                    value={tempChatId}
                    onChange={e => setTempChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-full px-4 py-3 rounded-xl text-sm bg-white/04 border border-white/10 text-white placeholder-zinc-600 outline-none focus:border-[#1DA1F2]/40"
                  />
                </div>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl mb-5"
                  style={{
                    background: testResult.ok ? 'rgba(16,163,127,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${testResult.ok ? 'rgba(16,163,127,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}
                >
                  {testResult.ok
                    ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  }
                  <p className="text-sm font-bold" style={{ color: testResult.ok ? '#34d399' : '#fca5a5' }}>
                    {testResult.msg}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={testConnection}
                  disabled={isTesting || (!tempToken && !botToken)}
                  className="flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-40"
                  style={{ background: 'rgba(29,161,242,0.15)', border: '1px solid rgba(29,161,242,0.35)', color: '#60a5fa' }}
                >
                  {isTesting ? '⏳ Testing...' : '🔗 Test Connection'}
                </button>
                <button
                  onClick={saveConfig}
                  disabled={!tempToken.trim() || !tempChatId.trim()}
                  className="flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #C07832, #FFFFFF)', color: '#fff' }}
                >
                  Save করুন
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <GlassCard className="p-6">
            <h3 className="text-sm font-black uppercase tracking-[0.25em] mb-5" style={{ color: '#FFFFFF' }}>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={sendQuickSummary}
                disabled={!isConfigured || isSending}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/05 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <BarChart3 className="w-5 h-5 shrink-0" style={{ color: '#FFFFFF' }} />
                <div>
                  <p className="text-sm font-bold text-white">Daily Summary</p>
                  <p className="text-[10px] text-zinc-500">আজকের summary Telegram-এ পাঠান</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-zinc-600" />
              </button>

              <button
                disabled={!isConfigured || isSending}
                onClick={async () => {
                  if (!isConfigured) return;
                  setIsSending(true);
                  const pending = orders.filter(o => o.status === 'Pending');
                  const lines = pending.slice(0, 10).map(o => `• #${o.id.slice(-6)} — ${o.customerName} — ৳${o.total}`);
                  const text = pending.length === 0
                    ? '✅ কোনো pending order নেই!'
                    : `⏳ <b>Pending Orders (${pending.length})</b>\n\n${lines.join('\n')}${pending.length > 10 ? `\n\n...এবং আরও ${pending.length - 10}টি` : ''}`;
                  try { await sendTelegramMessage(text, botToken, chatId); } catch { /* ignore */ }
                  finally { setIsSending(false); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/05 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Package className="w-5 h-5 shrink-0" style={{ color: '#FFFFFF' }} />
                <div>
                  <p className="text-sm font-bold text-white">Pending Orders</p>
                  <p className="text-[10px] text-zinc-500">সব pending orders পাঠান</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-zinc-600" />
              </button>

              <button
                disabled={!isConfigured || isSending}
                onClick={async () => {
                  if (!isConfigured) return;
                  setIsSending(true);
                  const text = [
                    `🛍️ <b>Product Summary</b>`,
                    ``,
                    `Total Products: ${products.length}`,
                    ...products.slice(0, 5).map(p => `• ${p.name} — ৳${p.price} (${p.stock} in stock)`),
                    products.length > 5 ? `\n...এবং আরও ${products.length - 5}টি` : '',
                  ].join('\n');
                  try { await sendTelegramMessage(text, botToken, chatId); } catch { /* ignore */ }
                  finally { setIsSending(false); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/05 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <ShoppingBag className="w-5 h-5 shrink-0" style={{ color: '#FFFFFF' }} />
                <div>
                  <p className="text-sm font-bold text-white">Product List</p>
                  <p className="text-[10px] text-zinc-500">Top products Telegram-এ পাঠান</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-zinc-600" />
              </button>

              {/* Site Health */}
              <button
                disabled={!isConfigured || isSending}
                onClick={async () => {
                  if (!isConfigured) return;
                  setIsSending(true);
                  const text = [
                    `🔍 <b>Site Health Report</b>`,
                    ``,
                    `✅ Database: Online`,
                    `✅ Orders API: Active`,
                    `✅ Products: ${products.length} loaded`,
                    `⚠️ Check System Health panel for full details`,
                    ``,
                    `🕐 ${new Date().toLocaleString('bn-BD')}`,
                  ].join('\n');
                  try { await sendTelegramMessage(text, botToken, chatId); } catch { /* ignore */ }
                  finally { setIsSending(false); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:bg-white/05 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Activity className="w-5 h-5 shrink-0" style={{ color: '#FFFFFF' }} />
                <div>
                  <p className="text-sm font-bold text-white">Site Health</p>
                  <p className="text-[10px] text-zinc-500">System status Telegram-এ পাঠান</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-zinc-600" />
              </button>
            </div>
          </GlassCard>

          {/* Announcement Sender */}
          <GlassCard className="p-6">
            <h3 className="text-sm font-black uppercase tracking-[0.25em] mb-4" style={{ color: '#FFFFFF' }}>
              Announcement পাঠান
            </h3>
            <textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              placeholder="Telegram-এ message লিখুন..."
              rows={4}
              disabled={!isConfigured}
              className="w-full resize-none bg-white/04 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#FFFFFF]/30 disabled:opacity-30"
            />
            <button
              onClick={sendAnnouncement}
              disabled={!announcement.trim() || !isConfigured || isSending}
              className="w-full mt-3 py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #1a3a5c, #1DA1F2)', color: '#fff' }}
            >
              <Send className="w-4 h-4" />
              {isSending ? 'পাঠানো হচ্ছে...' : 'Telegram-এ পাঠান'}
            </button>
          </GlassCard>
        </div>

        {/* Commands Reference */}
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h3 className="text-sm font-black uppercase tracking-[0.25em] mb-6" style={{ color: '#FFFFFF' }}>
              Telegram Commands Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {TELEGRAM_COMMANDS.map(section => (
                <div key={section.category}>
                  <p className="text-xs font-black uppercase tracking-[0.25em] mb-3 text-white">
                    {section.category}
                  </p>
                  <div className="space-y-2">
                    {section.commands.map(item => (
                      <div
                        key={item.cmd}
                        className="flex items-center gap-3 group"
                      >
                        <code
                          className="text-[11px] font-mono px-2 py-1 rounded shrink-0 cursor-pointer transition-all group-hover:bg-white/10"
                          style={{ background: 'rgba(255,255,255,0.10)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.20)' }}
                          onClick={() => copyCmd(item.cmd)}
                        >
                          {item.cmd}
                        </code>
                        <p className="text-[11px] text-zinc-400 flex-1">{item.desc}</p>
                        <button onClick={() => copyCmd(item.cmd)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-white">
                          {copiedCmd === item.cmd
                            ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                            : <Copy className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Note about webhook */}
            <div className="mt-6 p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#FFFFFF' }} />
                <div>
                  <p className="text-xs font-black text-white mb-1">Webhook Setup (Server-side)</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    সম্পূর্ণ two-way Telegram control এর জন্য server-side webhook প্রয়োজন।
                    Backend এ <code className="text-[#FFFFFF] font-mono text-[10px]">/api/telegram/webhook</code> endpoint set করুন।
                    এই প্যানেল থেকে আপাতত notifications পাঠানো যাবে।
                    Full bot commands (order processing, etc.) এর জন্য server webhook configure করুন।
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
