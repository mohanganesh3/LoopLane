import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const AdminStatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  loading = false,
  onClick,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 animate-pulse', className)}>
        <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="mt-3 h-7 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="mt-2 h-3 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 transition-colors',
        onClick && 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
        {Icon && <Icon size={16} className="text-zinc-400 dark:text-zinc-500" />}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
      </div>
      {(trend || subtitle) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend === 'down' && 'text-red-600 dark:text-red-400',
              trend === 'flat' && 'text-zinc-500'
            )}>
              {trend === 'up' && <ArrowUp size={12} />}
              {trend === 'down' && <ArrowDown size={12} />}
              {trend === 'flat' && <Minus size={12} />}
              {trendValue}
            </span>
          )}
          {subtitle && <span className="text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default AdminStatCard;
