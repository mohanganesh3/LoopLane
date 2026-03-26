import { cn } from '@/lib/utils';

const AdminPageHeader = ({ title, subtitle, actions, children, className = '' }) => {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export default AdminPageHeader;
