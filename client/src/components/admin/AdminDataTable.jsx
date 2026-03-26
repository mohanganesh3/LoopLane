import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const AdminDataTable = ({
  columns = [],
  data = [],
  loading = false,
  pagination = null,
  onPageChange,
  onSort,
  sortField,
  sortOrder,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  emptyMessage = 'No data found',
  searchable = false,
  onSearch,
  searchPlaceholder = 'Search...',
  actions,
  title,
  className = '',
}) => {
  const [localSearch, setLocalSearch] = useState('');

  const handleSort = (field) => {
    if (!onSort) return;
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(field, newOrder);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(row => row._id || row.id));
    }
  };

  const handleSelectRow = (id) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSearchChange = (e) => {
    setLocalSearch(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  if (loading) {
    return (
      <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden', className)}>
        {title && (
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-36 h-5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        )}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-4 animate-pulse">
              {columns.map((_, j) => (
                <div key={j} className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden', className)}>
      {/* Header */}
      {(title || searchable || actions) && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {title && <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{title}</h3>}
            {selectable && selectedIds.length > 0 && (
              <span className="text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 px-2 py-0.5 rounded-md ring-1 ring-inset ring-primary-200 dark:ring-primary-800">
                {selectedIds.length} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {searchable && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-56"
                />
              </div>
            )}
            {actions}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={handleSelectAll}
                    className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.field || col.key}
                  onClick={() => col.sortable && handleSort(col.field)}
                  className={cn(
                    'px-4 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 select-none',
                    col.className
                  )}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortField === col.field && (
                      sortOrder === 'asc'
                        ? <ChevronUp size={12} className="text-primary-600" />
                        : <ChevronDown size={12} className="text-primary-600" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center">
                  <Inbox size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowId = row._id || row.id || idx;
                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors',
                      onRowClick && 'cursor-pointer',
                      selectedIds.includes(rowId) && 'bg-primary-50/50 dark:bg-primary-900/10'
                    )}
                  >
                    {selectable && (
                      <td className="w-10 px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(rowId)}
                          onChange={() => handleSelectRow(rowId)}
                          className="rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.field || col.key} className={cn('px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300', col.cellClassName)}>
                        {col.render ? col.render(row[col.field], row) : row[col.field] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-sm">
          <p className="text-zinc-500 dark:text-zinc-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {[...Array(Math.min(pagination.totalPages || 1, 5))].map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange?.(page)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-sm transition-colors',
                    pagination.page === page
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                      : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDataTable;
