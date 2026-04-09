/**
 * AdminAIAgent.tsx
 * Master AI Copilot — Controls the entire Splaro site via natural language.
 * Supports: ChatGPT (OpenAI), Gemini (Google), Grok (xAI), DeepSeek, Claude (Anthropic)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Send, Sparkles, Settings2, Key, ChevronDown, Loader2,
  Trash2, Copy, CheckCircle, AlertTriangle, X, Zap, Brain,
  Package, ShoppingBag, Users, BarChart3, RefreshCcw, Bell,
  MessageSquare, PlusCircle, Activity
} from 'lucide-react';
import { useApp } from '../store';
import { GlassCard, PrimaryButton, LuxuryFloatingInput } from './LiquidGlass';

/* ─── AI Models ─────────────────────────────────────────── */
interface AIModel {
  id: string;
  label: string;
  provider: string;
  apiUrl: string;
  models: string[];
  defaultModel: string;
  color: string;
  logo: string;
}

const AI_MODELS: AIModel[] = [
  {
    id: 'openai',
    label: 'ChatGPT',
    provider: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
    color: '#10A37F',
    logo: '🤖',
  },
  {
    id: 'google',
    label: 'Gemini',
    provider: 'Google',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
    defaultModel: 'gemini-1.5-pro',
    color: '#4285F4',
    logo: '💎',
  },
  {
    id: 'xai',
    label: 'Grok',
    provider: 'xAI',
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    models: ['grok-2', 'grok-2-mini', 'grok-beta'],
    defaultModel: 'grok-2',
    color: '#1DA1F2',
    logo: '⚡',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    provider: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    color: '#7C3AED',
    logo: '🔮',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    provider: 'Anthropic',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    models: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-sonnet-4-5-20250929',
    color: '#D97706',
    logo: '🌟',
  },
];

/* ─── Message Types ──────────────────────────────────────── */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  action?: ActionResult;
  error?: boolean;
}

interface ActionResult {
  type: string;
  label: string;
  data?: Record<string, unknown>;
  executed?: boolean;
  result?: string;
}

/* ─── System Prompt ──────────────────────────────────────── */
const buildSystemPrompt = (stats: {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalUsers: number;
  siteName: string;
}) => `You are the Master AI Copilot for ${stats.siteName} — a premium luxury footwear e-commerce site in Bangladesh. You are the admin's personal assistant with full control over the website.

CURRENT SITE STATUS:
- Total Products: ${stats.totalProducts}
- Total Orders: ${stats.totalOrders}
- Pending Orders: ${stats.pendingOrders}
- Total Users: ${stats.totalUsers}

YOUR CAPABILITIES (what you can help with):
1. PRODUCTS: Add products, delete products, update prices, check inventory
2. ORDERS: View orders, process/update order status (Pending→Processing→Shipped→Delivered), cancel orders, get today's summary
3. USERS: View customer list, check user details
4. ANALYTICS: Revenue summary, order trends, top products
5. SETTINGS: Update site settings, toggle maintenance mode, change contact info
6. CONTENT: Update homepage, product descriptions, banners
7. DISCOUNTS: Create discount codes, view active discounts
8. NOTIFICATIONS: Send announcements to customers

RESPONSE FORMAT:
- Be concise and direct in Bangla or English (match the user's language)
- When you can execute an action, respond with: [ACTION:TYPE:DESCRIPTION] at the end
- For data requests, present the information clearly
- For confirmations needed, ask before executing destructive actions

Available ACTION codes:
- [ACTION:VIEW_ORDERS:Show all pending orders]
- [ACTION:VIEW_TODAY_ORDERS:Show today's orders]
- [ACTION:PROCESS_ALL_PENDING:Process all pending orders]
- [ACTION:VIEW_PRODUCTS:Show product list]
- [ACTION:VIEW_ANALYTICS:Show analytics dashboard]
- [ACTION:VIEW_USERS:Show user list]
- [ACTION:NAVIGATE_SETTINGS:Go to Settings]
- [ACTION:NAVIGATE_DISCOUNTS:Go to Discounts]
- [ACTION:TOGGLE_MAINTENANCE:Toggle maintenance mode]

Always be helpful, professional, and act as if you are the admin's trusted assistant managing this luxury brand.`;

/* ─── API Callers ────────────────────────────────────────── */
async function callOpenAI(apiKey: string, model: string, messages: Array<{role: string; content: string}>, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function callGemini(apiKey: string, model: string, messages: Array<{role: string; content: string}>, systemPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
    }),
  });
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGrok(apiKey: string, model: string, messages: Array<{role: string; content: string}>, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`Grok API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function callDeepSeek(apiKey: string, model: string, messages: Array<{role: string; content: string}>, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function callClaude(apiKey: string, model: string, messages: Array<{role: string; content: string}>, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: messages.filter(m => m.role !== 'system'),
      max_tokens: 1000,
    }),
  });
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

/* ─── Action Parser ──────────────────────────────────────── */
function parseActions(text: string): ActionResult | undefined {
  const match = text.match(/\[ACTION:([^:]+):([^\]]+)\]/);
  if (!match) return undefined;
  return { type: match[1], label: match[2] };
}

function cleanContent(text: string): string {
  return text.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

/* ─── Quick Commands ─────────────────────────────────────── */
const QUICK_COMMANDS = [
  { icon: Package,     label: "Today's Orders", cmd: "Show all orders for today" },
  { icon: RefreshCcw,  label: 'Process Pending', cmd: 'Process all pending orders' },
  { icon: BarChart3,   label: 'Revenue Summary', cmd: "Show today's revenue and order summary" },
  { icon: ShoppingBag, label: 'View Products', cmd: 'Show list of all products' },
  { icon: Users,       label: 'Customers', cmd: 'Show recent customer list' },
  { icon: Bell,        label: 'Announcement', cmd: 'I want to send an announcement to customers' },
];

/* ─── Main Component ─────────────────────────────────────── */
export const AdminAIAgent: React.FC = () => {
  const { products, orders, siteSettings, setView } = useApp();

  // ── State ──
  const [selectedModelId, setSelectedModelId] = useState<string>(() =>
    localStorage.getItem('splaro-ai-model') || 'openai'
  );
  const [selectedSubModel, setSelectedSubModel] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('splaro-ai-keys') || '{}'); } catch { return {}; }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: `Welcome! I am Splaro's Master AI Copilot. You can command me in natural English to manage the boutique:\n\n• View and process orders\n• Add or modify products\n• View sales analytics\n• Update site settings\n• Access customer profiles\n\nPlease configure your preferred AI model and API key in the configuration panel on the left to begin.`,
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modelDropdown, setModelDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModelId) || AI_MODELS[0];
  const currentSubModel = selectedSubModel || currentModel.defaultModel;

  // Stats for system prompt
  const stats = {
    totalProducts: products.length,
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'Pending').length,
    totalUsers: 0,
    siteName: siteSettings.siteName || 'Splaro',
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedSubModel === '' || !currentModel.models.includes(selectedSubModel)) {
      setSelectedSubModel(currentModel.defaultModel);
    }
  }, [selectedModelId, currentModel]);

  const saveApiKey = useCallback(() => {
    if (!tempApiKey.trim()) return;
    const updated = { ...apiKeys, [selectedModelId]: tempApiKey.trim() };
    setApiKeys(updated);
    localStorage.setItem('splaro-ai-keys', JSON.stringify(updated));
    setTempApiKey('');
    setShowSettings(false);
  }, [apiKeys, selectedModelId, tempApiKey]);

  const selectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    localStorage.setItem('splaro-ai-model', modelId);
    setModelDropdown(false);
    setTempApiKey(apiKeys[modelId] || '');
  }, [apiKeys]);

  const executeAction = useCallback(async (action: ActionResult, msgId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, action: { ...action, executed: true, result: 'Navigating...' } } : m
    ));
    const nav: Record<string, string> = {
      VIEW_ORDERS: '?tab=ORDERS',
      VIEW_TODAY_ORDERS: '?tab=ORDERS',
      PROCESS_ALL_PENDING: '?tab=ORDERS',
      VIEW_PRODUCTS: '?tab=PRODUCTS',
      VIEW_ANALYTICS: '?tab=ANALYTICS',
      VIEW_USERS: '?tab=USERS',
      NAVIGATE_SETTINGS: '?tab=SETTINGS',
      NAVIGATE_DISCOUNTS: '?tab=DISCOUNTS',
    };
    if (nav[action.type]) {
      window.history.pushState({}, '', `/admin${nav[action.type]}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, action: { ...action, executed: true, result: '✓ Done' } } : m
    ));
  }, [setView]);

  const sendMessage = useCallback(async (userInput?: string) => {
    const text = (userInput ?? input).trim();
    if (!text || isLoading) return;

    const apiKey = apiKeys[selectedModelId];
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const historyForApi = messages
      .filter(m => m.role !== 'system' && m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    historyForApi.push({ role: 'user', content: text });

    const sysPrompt = buildSystemPrompt(stats);

    try {
      let response = '';
      switch (selectedModelId) {
        case 'openai':   response = await callOpenAI(apiKey, currentSubModel, historyForApi, sysPrompt); break;
        case 'google':   response = await callGemini(apiKey, currentSubModel, historyForApi, sysPrompt); break;
        case 'xai':      response = await callGrok(apiKey, currentSubModel, historyForApi, sysPrompt); break;
        case 'deepseek': response = await callDeepSeek(apiKey, currentSubModel, historyForApi, sysPrompt); break;
        case 'anthropic': response = await callClaude(apiKey, currentSubModel, historyForApi, sysPrompt); break;
        default: throw new Error('Unknown model');
      }

      const action = parseActions(response);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: cleanContent(response),
        timestamp: new Date(),
        action,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `❌ Error: ${errMsg}\n\nPlease verify your API key or try selecting a different model version.`,
        timestamp: new Date(),
        error: true,
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, apiKeys, selectedModelId, messages, stats, currentSubModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const clearChat = () => setMessages([{
    id: 'welcome-new',
    role: 'assistant',
    content: 'Contextual memory cleared. How can I assist you further?',
    timestamp: new Date(),
  }]);

  const hasKey = !!apiKeys[selectedModelId];

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 overflow-hidden">

      {/* ── LEFT: Model Config Panel ── */}
      <div className="w-72 shrink-0 flex flex-col gap-4">

        {/* Model Selector */}
        <GlassCard className="p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] mb-3" style={{ color: '#FFFFFF' }}>
            AI Model
          </p>
          <div className="relative">
            <button
              onClick={() => setModelDropdown(prev => !prev)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${currentModel.color}44`,
                color: '#FFFFFF',
              }}
            >
              <span className="text-lg">{currentModel.logo}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-black">{currentModel.label}</p>
                <p className="text-[9px] opacity-50">{currentModel.provider}</p>
              </div>
              <ChevronDown className="w-4 h-4 opacity-40" />
            </button>
            <AnimatePresence>
              {modelDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-full mt-2 w-full rounded-xl border overflow-hidden z-50"
                  style={{ background: '#0F1A10', border: '1px solid rgba(255,255,255,0.20)' }}
                >
                  {AI_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => selectModel(model.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-white/05 text-left"
                    >
                      <span className="text-base">{model.logo}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{model.label}</p>
                        <p className="text-[9px] text-white/40">{model.provider}</p>
                      </div>
                      {selectedModelId === model.id && (
                        <CheckCircle className="w-4 h-4 ml-auto" style={{ color: '#FFFFFF' }} />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sub Model Selector */}
          <div className="mt-3">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-2 text-zinc-500">Model Version</p>
            <select
              value={currentSubModel}
              onChange={e => setSelectedSubModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#FFFFFF',
              }}
            >
              {currentModel.models.map(m => (
                <option key={m} value={m} style={{ background: '#0F1A10' }}>{m}</option>
              ))}
            </select>
          </div>
        </GlassCard>

        {/* API Key */}
        <GlassCard className="p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] mb-3" style={{ color: '#FFFFFF' }}>
            API Key — {currentModel.label}
          </p>
          {hasKey ? (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(16,163,127,0.08)', border: '1px solid rgba(16,163,127,0.25)' }}>
              <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#10A37F' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">API Key Verified</p>
                <p className="text-[9px] text-zinc-500 truncate">{apiKeys[selectedModelId].slice(0, 10)}••••</p>
              </div>
              <button onClick={() => { setTempApiKey(apiKeys[selectedModelId]); setShowSettings(true); }} className="text-zinc-400 hover:text-white transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <p className="text-xs font-bold text-rose-300">Key Required</p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="w-full py-2.5 rounded-xl text-xs font-black uppercase transition-all"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.30)', color: '#FFFFFF' }}
              >
                <Key className="w-3.5 h-3.5 inline mr-2" />
                Initialize Key
              </button>
            </div>
          )}
        </GlassCard>

        {/* Quick Commands */}
        <GlassCard className="p-5 flex-1 overflow-y-auto">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] mb-3" style={{ color: '#FFFFFF' }}>
            Quick Commands
          </p>
          <div className="flex flex-col gap-2">
            {QUICK_COMMANDS.map((cmd, i) => (
              <button
                key={i}
                onClick={() => sendMessage(cmd.cmd)}
                disabled={!hasKey || isLoading}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/05 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <cmd.icon className="w-4 h-4 shrink-0" style={{ color: '#FFFFFF' }} />
                <p className="text-[11px] font-semibold text-white/80">{cmd.label}</p>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Clear Chat */}
        <button
          onClick={clearChat}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all"
          style={{ border: '1px solid rgba(239,68,68,0.20)', color: 'rgba(239,68,68,0.60)' }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Registry
        </button>
      </div>

      {/* ── RIGHT: Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
            style={{ background: `${currentModel.color}18`, border: `1px solid ${currentModel.color}44` }}
          >
            {currentModel.logo}
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white">
              Master AI Copilot
            </h2>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">
              {currentModel.label} · {currentSubModel} · {hasKey ? '✓ Connected' : '⚠ No API Key'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase"
              style={{
                background: hasKey ? 'rgba(16,163,127,0.12)' : 'rgba(239,68,68,0.10)',
                border: `1px solid ${hasKey ? 'rgba(16,163,127,0.30)' : 'rgba(239,68,68,0.25)'}`,
                color: hasKey ? '#10A37F' : '#ef4444',
              }}
            >
              <Activity className="w-3 h-3" />
              {hasKey ? 'Active' : 'No Key'}
            </div>
          </div>
        </div>

        {/* Messages */}
        <GlassCard className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-h-0">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-sm"
                  style={{
                    background: msg.role === 'user'
                      ? 'rgba(255,255,255,0.15)'
                      : `${currentModel.color}18`,
                    border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.30)' : currentModel.color + '44'}`,
                  }}
                >
                  {msg.role === 'user' ? '👤' : currentModel.logo}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                  <div
                    className="px-5 py-4 rounded-xl text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user'
                        ? 'rgba(255,255,255,0.12)'
                        : msg.error
                          ? 'rgba(239,68,68,0.08)'
                          : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${
                        msg.role === 'user'
                          ? 'rgba(255,255,255,0.25)'
                          : msg.error
                            ? 'rgba(239,68,68,0.20)'
                            : 'rgba(255,255,255,0.08)'
                      }`,
                      color: msg.error ? '#fca5a5' : '#FFFFFF',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Action Button */}
                  {msg.action && !msg.action.executed && (
                    <button
                      onClick={() => executeAction(msg.action!, msg.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        border: '1px solid rgba(255,255,255,0.40)',
                        color: '#FFFFFF',
                      }}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {msg.action.label}
                    </button>
                  )}
                  {msg.action?.executed && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {msg.action.result}
                    </span>
                  )}

                  {/* Timestamp + Copy */}
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-zinc-600">
                      {msg.timestamp.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => copyMessage(msg.content, msg.id)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      {copiedId === msg.id
                        ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                        : <Copy className="w-3 h-3" />
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                style={{ background: `${currentModel.color}18`, border: `1px solid ${currentModel.color}44` }}>
                {currentModel.logo}
              </div>
              <div className="px-5 py-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex gap-1.5 items-center">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: currentModel.color }} />
                  <span className="text-xs text-zinc-400">{currentModel.label} is indexing...</span>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </GlassCard>

        {/* Input Area */}
        <div
          className="mt-4 flex gap-3 items-end p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasKey
              ? `Ask ${currentModel.label}... (Enter to send, Shift+Enter for new line)`
              : 'Please configure your API key to proceed →'
            }
            disabled={!hasKey || isLoading}
            rows={2}
            className="flex-1 resize-none bg-transparent outline-none text-sm text-white placeholder-zinc-600 leading-relaxed"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || !hasKey || isLoading}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #C07832, #FFFFFF)',
              boxShadow: '0 4px 20px rgba(255,255,255,0.30)',
            }}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Send className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* ── API Key Modal ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md mx-4 p-8 rounded-xl"
              style={{ background: '#0F1A10', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currentModel.logo}</span>
                  <div>
                    <h3 className="text-lg font-black text-white">{currentModel.label} API Key</h3>
                    <p className="text-[10px] text-zinc-400">{currentModel.provider}</p>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-2">API Key</p>
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                    placeholder={`Paste ${currentModel.label} API key here...`}
                    className="w-full px-4 py-3 rounded-xl text-sm bg-white/04 border border-white/10 text-white placeholder-zinc-600 outline-none focus:border-[#FFFFFF]/40"
                    autoFocus
                  />
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    🔒 API keys are stored locally in your browser. They are nunca transit through our servers.
                    {currentModel.id === 'openai' && ' Access: platform.openai.com'}
                    {currentModel.id === 'google' && ' Access: aistudio.google.com'}
                    {currentModel.id === 'xai' && ' Access: console.x.ai'}
                    {currentModel.id === 'deepseek' && ' Access: platform.deepseek.com'}
                    {currentModel.id === 'anthropic' && ' Access: console.anthropic.com'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-xl text-xs font-bold border border-white/10 text-zinc-400">
                    Cancel
                  </button>
                  <button
                    onClick={saveApiKey}
                    disabled={!tempApiKey.trim()}
                    className="flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #C07832, #FFFFFF)', color: '#fff' }}
                  >
                    Save Key
                  </button>
                </div>
                {apiKeys[selectedModelId] && (
                  <button
                    onClick={() => {
                      const updated = { ...apiKeys };
                      delete updated[selectedModelId];
                      setApiKeys(updated);
                      localStorage.setItem('splaro-ai-keys', JSON.stringify(updated));
                      setTempApiKey('');
                      setShowSettings(false);
                    }}
                    className="w-full py-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Revoke API Key
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
