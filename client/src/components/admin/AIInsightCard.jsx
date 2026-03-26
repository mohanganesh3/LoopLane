import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';

/** Stable hash of metrics object so we re-fetch only on meaningful data changes */
function metricsHash(m) {
  if (!m || typeof m !== 'object') return '';
  // Sort keys for stability, round numbers to avoid float drift
  const sorted = Object.keys(m).sort().reduce((acc, k) => {
    const v = m[k];
    acc[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    return acc;
  }, {});
  return JSON.stringify(sorted);
}

const AIInsightCard = ({ context = 'general', metrics = {}, title = 'AI Insight', autoLoad = true, className = '' }) => {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const lastHash = useRef('');
  const typingTimer = useRef(null);

  // Stable hash tracks real data changes, not object identity
  const currentHash = useMemo(() => metricsHash(metrics), [metrics]);

  const fetchInsight = useCallback(async (metricsSnapshot) => {
    setLoading(true);
    setError(null);
    setDisplayedText('');
    if (typingTimer.current) clearInterval(typingTimer.current);
    try {
      const response = await adminService.getAIInsight(context, metricsSnapshot);
      if (response.success && response.data) {
        setInsight(response.data);
        setIsTyping(true);
        const text = response.data.insight;
        let i = 0;
        typingTimer.current = setInterval(() => {
          if (i < text.length) {
            setDisplayedText(text.substring(0, i + 1));
            i++;
          } else {
            clearInterval(typingTimer.current);
            typingTimer.current = null;
            setIsTyping(false);
          }
        }, 12);
      }
    } catch (err) {
      setError('Failed to generate insight');
    } finally {
      setLoading(false);
    }
  }, [context]);

  // Re-fetch when metrics meaningfully change (hash-based comparison)
  useEffect(() => {
    if (!autoLoad) return;
    if (!currentHash || currentHash === '{}') return; // no data yet
    if (currentHash === lastHash.current) return;      // no meaningful change
    lastHash.current = currentHash;

    // Stagger AI calls by 200-1500ms to avoid burst
    const delay = Math.floor(Math.random() * 1300) + 200;
    const timer = setTimeout(() => fetchInsight(metrics), delay);
    return () => clearTimeout(timer);
  }, [autoLoad, currentHash, fetchInsight, metrics]);

  // Cleanup typing timer on unmount
  useEffect(() => {
    return () => { if (typingTimer.current) clearInterval(typingTimer.current); };
  }, []);

  return (
    <div className={cn('rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary-600 dark:text-primary-400" />
          <div>
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h4>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {insight?.model === 'rule-based-fallback' ? 'Rule-based' : 'Gemini 2.5 Flash'}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchInsight(metrics)}
          disabled={loading}
          className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[48px]">
        {loading && !displayedText ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Analyzing data...</span>
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        ) : displayedText ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {displayedText}
            {isTyping && <span className="inline-block w-0.5 h-4 bg-primary-500 ml-0.5 animate-pulse" />}
          </p>
        ) : !autoLoad ? (
          <button
            onClick={fetchInsight}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline underline-offset-2"
          >
            Click to generate AI insight
          </button>
        ) : null}
      </div>

      {/* Footer timestamp */}
      {insight?.timestamp && !loading && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-3">
          Generated {new Date(insight.timestamp).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default AIInsightCard;
