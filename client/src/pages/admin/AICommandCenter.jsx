/**
 * Operations Console — Intelligent admin assistant for LoopLane
 * 
 * Redesigned as a native admin tool, not a chatbot.
 * - Multi-turn conversations with Gemini 2.5 Flash (function calling)
 * - Real-time tool execution with subtle progress indicators
 * - Rich markdown rendering (tables, code, lists)
 * - Category-based quick actions
 * - Seamless dark/light mode with admin panel design language
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, RotateCcw, Sparkles, Terminal, Clock, ChevronRight,
  TrendingUp, Users, Shield, Car, Wallet, Activity,
  BarChart3, Search, AlertTriangle, Zap, ArrowRight, Copy, Check,
  Loader2, CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '../../services/api';

/* ═══════════════════════════════════════════════════════════════
   Markdown Renderer
   ═══════════════════════════════════════════════════════════════ */
function renderMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 rounded-lg p-4 my-3 overflow-x-auto text-[13px] leading-relaxed font-mono border border-zinc-200 dark:border-zinc-700"><code>${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[12px] font-mono border border-zinc-200 dark:border-zinc-700/50">$1</code>');

  // Tables
  html = html.replace(/(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (match, header, sep, body) => {
    const headers = header.split('|').filter(c => c.trim());
    const rows = body.trim().split('\n').filter(r => r.trim());
    let t = '<div class="overflow-x-auto my-4 rounded-lg border border-zinc-200 dark:border-zinc-700"><table class="min-w-full text-sm">';
    t += '<thead><tr class="bg-zinc-50 dark:bg-zinc-800/60">';
    headers.forEach(h => { t += `<th class="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">${h.trim()}</th>`; });
    t += '</tr></thead><tbody class="divide-y divide-zinc-100 dark:divide-zinc-700/50">';
    rows.forEach((row) => {
      const cells = row.split('|').filter(c => c.trim());
      t += '<tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">';
      cells.forEach(c => { t += `<td class="px-4 py-2 text-zinc-700 dark:text-zinc-300">${c.trim()}</td>`; });
      t += '</tr>';
    });
    t += '</tbody></table></div>';
    return t;
  });

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-5 mb-1.5">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2">$1</h1>');

  // Bold / Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-900 dark:text-zinc-100 font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="text-zinc-600 dark:text-zinc-400">$1</em>');

  // Lists
  html = html.replace(/^[\s]*[-•] (.+)$/gm, '<li class="ml-4 list-disc text-zinc-700 dark:text-zinc-300 leading-relaxed">$1</li>');
  html = html.replace(/((?:<li class="ml-4 list-disc[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-2.5 space-y-1">$1</ul>');
  html = html.replace(/^[\s]*\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-zinc-700 dark:text-zinc-300 leading-relaxed">$1</li>');
  html = html.replace(/((?:<li class="ml-4 list-decimal[^>]*>.*<\/li>\n?)+)/g, '<ol class="my-2.5 space-y-1">$1</ol>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="border-zinc-200 dark:border-zinc-700 my-4" />');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p class="my-2 text-zinc-700 dark:text-zinc-300 leading-relaxed text-[14px]">');
  html = html.replace(/(?<!>)\n(?!<)/g, '<br/>');

  if (!html.match(/^<(h[1-6]|pre|div|table|ul|ol|hr)/)) {
    html = `<p class="my-2 text-zinc-700 dark:text-zinc-300 leading-relaxed text-[14px]">${html}</p>`;
  }
  return html;
}

/* ═══════════════════════════════════════════════════════════════
   Tool Labels
   ═══════════════════════════════════════════════════════════════ */
const TOOL_LABELS = {
  get_platform_overview: 'Platform overview',
  get_revenue_analytics: 'Revenue data',
  get_user_analytics: 'User segments',
  get_ride_analytics: 'Ride patterns',
  get_booking_analytics: 'Booking funnel',
  get_safety_report: 'Safety metrics',
  get_driver_performance: 'Driver performance',
  get_financial_details: 'Financial data',
  get_real_time_activity: 'Live activity',
  search_users: 'User search',
  get_user_deep_dive: 'User profile',
  get_reports_overview: 'Reports scan',
  get_growth_metrics: 'Growth metrics',
  get_review_analytics: 'Review analysis',
  get_route_demand_analysis: 'Route demand',
  get_data_catalog: 'Data catalog',
  query_records: 'Record query',
  aggregate_records: 'Aggregation',
  get_audit_trail: 'Audit trail',
};

const TOOL_COUNT = Object.keys(TOOL_LABELS).length;

/* ═══════════════════════════════════════════════════════════════
   Query Categories
   ═══════════════════════════════════════════════════════════════ */
const QUERY_CATEGORIES = [
  {
    label: 'Revenue & Finance',
    icon: Wallet,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    queries: [
      'Revenue trend this month vs last month',
      'Break down financial health — refunds, payments, revenue by day',
      'What is our average transaction value and how is it changing?',
    ],
  },
  {
    label: 'Users & Growth',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/20',
    queries: [
      'User growth and signup trends this quarter',
      'Are we growing or shrinking? Show growth metrics',
      'Which users have the highest lifetime value?',
    ],
  },
  {
    label: 'Rides & Routes',
    icon: Car,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    border: 'border-violet-200 dark:border-violet-500/20',
    queries: [
      'Most popular routes and demand patterns',
      'Booking conversion funnel analysis',
      'What is our ride completion rate and how can we improve it?',
    ],
  },
  {
    label: 'Safety & Trust',
    icon: Shield,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
    queries: [
      'Safety and trust overview — any red flags?',
      'All pending and escalated reports',
      'Who are the highest-risk users on the platform?',
    ],
  },
  {
    label: 'Operations',
    icon: Activity,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/20',
    queries: [
      'What needs my immediate attention right now?',
      'Platform health report with key metrics',
      'Any concerning trends I should know about?',
    ],
  },
  {
    label: 'Performance',
    icon: TrendingUp,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    border: 'border-cyan-200 dark:border-cyan-500/20',
    queries: [
      'Top and worst performing drivers this month',
      'Peak hours analysis and demand-supply gap',
      'Review and rating distribution across drivers',
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   Message Components
   ═══════════════════════════════════════════════════════════════ */
function ToolChips({ tools }) {
  if (!tools?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {tools.map((tool, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px] rounded-md font-medium border border-zinc-200 dark:border-zinc-700">
          <Terminal size={10} className="opacity-60" />
          {TOOL_LABELS[tool] || tool.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700" title="Copy response">
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-zinc-400" />}
    </button>
  );
}

function AssistantMessage({ message }) {
  return (
    <div className="animate-slideUp group">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center flex-shrink-0">
          <Sparkles size={10} className="text-white dark:text-zinc-900" />
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Assistant</span>
        {message.responseTime && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
            <Clock size={9} /> {(message.responseTime / 1000).toFixed(1)}s
          </span>
        )}
        {message.toolsUsed?.length > 0 && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{message.toolsUsed.length} {message.toolsUsed.length === 1 ? 'query' : 'queries'}</span>
        )}
        <CopyButton text={message.response} />
      </div>

      <ToolChips tools={message.toolsUsed} />

      <div
        className="prose prose-zinc dark:prose-invert prose-sm max-w-none bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm text-[14px] leading-relaxed overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.response) }}
      />
    </div>
  );
}

function UserMessage({ message }) {
  return (
    <div className="animate-slideUp">
      <div className="flex items-center gap-2 mb-2 justify-end">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">You</span>
      </div>
      <div className="flex justify-end">
        <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl rounded-tr-sm px-5 py-3 text-sm leading-relaxed max-w-[80%]">
          {message.text}
        </div>
      </div>
    </div>
  );
}

function ThinkingState({ activeTools }) {
  return (
    <div className="animate-slideUp">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center flex-shrink-0">
          <Sparkles size={10} className="text-white dark:text-zinc-900 animate-pulse" />
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Working...</span>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {activeTools.length > 0 ? (
          <div className="space-y-2.5">
            {activeTools.map((tool, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin flex-shrink-0" />
                <span className="text-zinc-600 dark:text-zinc-300">{TOOL_LABELS[tool] || tool.replace(/_/g, ' ')}...</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-zinc-400">Analyzing your request...</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Welcome Screen
   ═══════════════════════════════════════════════════════════════ */
function WelcomeScreen({ onQuery }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
              <Terminal size={18} className="text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Operations Console</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {TOOL_COUNT} data connectors &middot; Real-time queries &middot; Gemini 2.5 Flash
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
            Ask questions about your platform in plain language. I&apos;ll query your live database, 
            analyze the results, and give you actionable insights.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-zinc-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { text: 'Platform health report', icon: BarChart3 },
              { text: 'What needs my attention right now?', icon: AlertTriangle },
              { text: 'Revenue trend this month', icon: TrendingUp },
              { text: 'User growth overview', icon: Users },
              { text: 'Top performing drivers', icon: Car },
              { text: 'Safety & trust status', icon: Shield },
            ].map((q, i) => (
              <button
                key={i}
                onClick={() => onQuery(q.text)}
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl text-left transition-all group"
              >
                <q.icon size={15} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                <span className="text-sm text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">{q.text}</span>
                <ArrowRight size={12} className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 ml-auto opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Category Explorer */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Search size={14} className="text-zinc-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Explore by Category</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUERY_CATEGORIES.map((cat, ci) => (
              <div
                key={ci}
                className={cn(
                  'rounded-xl border transition-all',
                  expandedCategory === ci
                    ? `${cat.bg} ${cat.border}`
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <button
                  onClick={() => setExpandedCategory(expandedCategory === ci ? null : ci)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <cat.icon size={16} className={cn(expandedCategory === ci ? cat.color : 'text-zinc-400')} />
                  <span className={cn('text-sm font-medium', expandedCategory === ci ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300')}>
                    {cat.label}
                  </span>
                  <ChevronRight size={14} className={cn('ml-auto text-zinc-400 transition-transform', expandedCategory === ci && 'rotate-90')} />
                </button>
                {expandedCategory === ci && (
                  <div className="px-4 pb-3 space-y-1">
                    {cat.queries.map((q, qi) => (
                      <button
                        key={qi}
                        onClick={() => onQuery(q)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-800/60 rounded-lg transition-colors"
                      >
                        <CircleDot size={8} className="text-zinc-400 flex-shrink-0" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center mt-10">
          Responses are generated from live database queries. Results may vary with data changes.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function AICommandCenter() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState([]);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const streamEndpoint = useMemo(() => {
    const baseUrl = api.defaults.baseURL || window.location.origin;
    try { return new URL('/api/admin/ai/chat/stream', baseUrl).toString(); }
    catch { return '/api/admin/ai/chat/stream'; }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  /* --- Send Message --- */
  const sendMessage = useCallback(async (text) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setInput('');
    setError(null);
    setActiveTools([]);
    setStreamingResponse('');

    const userMsg = { type: 'user', text: messageText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let fullResponse = '';
      let toolsUsed = [];
      let responseTime = null;

      try {
        const streamRes = await fetch(streamEndpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ message: messageText }),
        });

        if (!streamRes.ok || !streamRes.body) {
          let errMsg = `Request failed (${streamRes.status})`;
          try { const ep = await streamRes.json(); errMsg = ep?.message || errMsg; } catch {}
          throw new Error(errMsg);
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processBlock = (block) => {
          const dataLines = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
          if (!dataLines.length) return;
          const payload = JSON.parse(dataLines.join(''));

          if (payload.type === 'tool' && payload.tool) {
            setActiveTools(prev => prev.includes(payload.tool) ? prev : [...prev, payload.tool]);
          } else if (payload.type === 'chunk' && payload.text) {
            fullResponse += payload.text;
            setStreamingResponse(fullResponse);
          } else if (payload.type === 'done') {
            toolsUsed = payload.toolsUsed || toolsUsed;
            responseTime = payload.responseTime ?? responseTime;
          } else if (payload.type === 'error') {
            throw new Error(payload.message || 'Stream failed');
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          for (const block of blocks) processBlock(block);
          if (done) { if (buffer.trim()) processBlock(buffer); break; }
        }
      } catch (streamErr) {
        setStreamingResponse('');
        setActiveTools([]);
        const response = await api.post('/api/admin/ai/chat', { message: messageText });
        if (!response.data?.success) throw new Error(response.data?.message || 'Unknown error');
        fullResponse = response.data.data?.response || '';
        toolsUsed = response.data.data?.toolsUsed || [];
        responseTime = response.data.data?.responseTime ?? null;
      }

      if (!fullResponse.trim()) throw new Error('Empty response received');

      setMessages(prev => [...prev, {
        type: 'ai', response: fullResponse, toolsUsed, responseTime, timestamp: Date.now(),
      }]);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to get response';
      setError(errorMsg);
      setMessages(prev => [...prev, {
        type: 'ai',
        response: `**Error:** ${errorMsg}\n\nPlease try again or rephrase your question.`,
        toolsUsed: [],
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setActiveTools([]);
      setStreamingResponse('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, streamEndpoint]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const clearConversation = useCallback(async () => {
    try { await api.delete('/api/admin/ai/chat/history'); } catch {}
    setMessages([]);
    setError(null);
    setStreamingResponse('');
    setActiveTools([]);
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-zinc-50 dark:bg-zinc-950">

      {/* ─── Header ─── */}
      <div className="flex-shrink-0 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
              <Terminal size={14} className="text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Operations Console
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium rounded border border-emerald-200 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{TOOL_COUNT} data connectors &middot; Real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMessages && (
              <button
                onClick={clearConversation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-all font-medium"
              >
                <RotateCcw size={12} />
                New Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Chat / Welcome ─── */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <WelcomeScreen onQuery={sendMessage} />
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-6 pb-4">
            {messages.map((msg, i) =>
              msg.type === 'user'
                ? <UserMessage key={i} message={msg} />
                : <AssistantMessage key={i} message={msg} />
            )}
            {isLoading && (
              streamingResponse
                ? <AssistantMessage message={{ type: 'ai', response: streamingResponse, toolsUsed: activeTools, timestamp: Date.now() }} />
                : <ThinkingState activeTools={activeTools} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Suggestion Chips (during conversation) ─── */}
      {hasMessages && !isLoading && (
        <div className="flex-shrink-0 px-6 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {[
                'Platform health report',
                'Revenue trend',
                'Pending reports',
                'Top drivers',
                'User growth',
                'Safety overview',
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 whitespace-nowrap transition-all font-medium flex-shrink-0"
                >
                  {q}
                  <ChevronRight size={10} className="opacity-50" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Input ─── */}
      <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about revenue, users, rides, safety, or anything else..."
                rows={1}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none transition-all outline-none"
                style={{ maxHeight: '120px', minHeight: '44px' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className={cn(
                'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                input.trim() && !isLoading
                  ? 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
              )}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
              Enter to send &middot; Shift+Enter for new line
            </p>
            {input.length > 0 && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{input.length}/2000</p>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.25s ease-out forwards;
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
