import { cn } from '@/lib/utils';

const STATUS_VARIANTS = {
  // Positive
  ACTIVE: 'success', COMPLETED: 'info', CONFIRMED: 'success', VERIFIED: 'success',
  RESOLVED: 'success', PAID: 'success', LOW: 'success',
  // Warning
  PENDING: 'warning', ESCALATED: 'warning', MEDIUM: 'warning',
  // Negative
  CANCELLED: 'danger', SUSPENDED: 'danger', CRITICAL: 'danger',
  FAILED: 'danger', HIGH: 'danger',
  // Neutral
  IN_PROGRESS: 'info', REFUNDED: 'info', UNVERIFIED: 'default',
};

const variantStyles = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  default: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
};

const StatusBadge = ({ status, size = 'sm', className = '' }) => {
  const variant = STATUS_VARIANTS[status] || 'default';
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-md ring-1 ring-inset',
      sizeClasses,
      variantStyles[variant],
      className
    )}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
