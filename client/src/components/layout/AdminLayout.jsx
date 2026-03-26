import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserDisplayName, getUserPhoto, getInitials, getAvatarColor } from '../../utils/imageHelpers';
import { isFullAdmin } from '../../utils/roles';
import { cn } from '@/lib/utils';
import {
  Brain, BarChart3, Globe, Users, UserCheck, Car, ClipboardList,
  AlertTriangle, Flag, MapPin, PieChart, Wallet, UserCog, FileText,
  Settings, Shield, UserMinus, Tag, Leaf, SlidersHorizontal, Activity,
  ChevronsLeft, ChevronsRight, ArrowLeft, LogOut, User, ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '../ui/DropdownMenu';

const safeSrc = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
  } catch { return ''; }
};

const ICON_MAP = {
  brain: Brain, 'bar-chart': BarChart3, globe: Globe, users: Users,
  'user-check': UserCheck, car: Car, clipboard: ClipboardList,
  'alert-triangle': AlertTriangle, flag: Flag, 'map-pin': MapPin,
  'pie-chart': PieChart, wallet: Wallet, 'user-cog': UserCog,
  'file-text': FileText, settings: Settings, shield: Shield,
  'user-minus': UserMinus, tag: Tag, leaf: Leaf,
  sliders: SlidersHorizontal, activity: Activity,
};

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch {}
    navigate('/admin/login');
  }, [logout, navigate]);

  const permissions = user?.employeeDetails?.permissions || [];
  const userIsFullAdmin = isFullAdmin(user?.role);
  const hasPermission = (perm) => userIsFullAdmin || permissions.includes(perm);

  const navGroups = useMemo(() => {
    const groups = [
      {
        label: 'AI',
        items: [
          { path: '/admin/ai', icon: 'brain', label: 'Command Center', show: true },
        ],
      },
      {
        label: 'Overview',
        items: [
          { path: '/admin/dashboard', icon: 'bar-chart', label: 'Dashboard', show: true },
          { path: '/admin/bird-eye', icon: 'globe', label: 'Bird Eye', show: userIsFullAdmin || hasPermission('manage_reports') },
        ],
      },
      {
        label: 'Operations',
        items: [
          { path: '/admin/rides', icon: 'car', label: 'Rides', show: hasPermission('manage_rides') },
          { path: '/admin/bookings', icon: 'clipboard', label: 'Bookings', show: hasPermission('manage_rides') },
          { path: '/admin/geo-fencing', icon: 'map-pin', label: 'Geo-Fencing', show: hasPermission('manage_rides') },
        ],
      },
      {
        label: 'Users',
        items: [
          { path: '/admin/users', icon: 'users', label: 'Users', show: hasPermission('manage_users') },
          { path: '/admin/verifications', icon: 'user-check', label: 'Verifications', show: hasPermission('manage_users') },
          { path: '/admin/employees', icon: 'user-cog', label: 'Employees', show: userIsFullAdmin },
        ],
      },
      {
        label: 'Safety & Trust',
        items: [
          { path: '/admin/safety', icon: 'alert-triangle', label: 'Safety', show: hasPermission('manage_reports') },
          { path: '/admin/reports', icon: 'flag', label: 'Reports', show: hasPermission('manage_reports') },
          { path: '/admin/fraud', icon: 'shield', label: 'Fraud', show: userIsFullAdmin },
        ],
      },
      {
        label: 'Finance',
        items: [
          { path: '/admin/financials', icon: 'wallet', label: 'Financials', show: hasPermission('manage_finances') },
          { path: '/admin/analytics', icon: 'pie-chart', label: 'Analytics', show: hasPermission('manage_finances') || hasPermission('manage_rides') },
          { path: '/admin/promo-codes', icon: 'tag', label: 'Promo Codes', show: hasPermission('manage_finances') },
          { path: '/admin/pricing', icon: 'sliders', label: 'Pricing', show: hasPermission('manage_finances') },
        ],
      },
      {
        label: 'Platform',
        items: [
          { path: '/admin/churn', icon: 'user-minus', label: 'Churn', show: userIsFullAdmin || hasPermission('manage_users') },
          { path: '/admin/sustainability', icon: 'leaf', label: 'Sustainability', show: hasPermission('manage_reports') },
          { path: '/admin/health', icon: 'activity', label: 'System Health', show: userIsFullAdmin },
          { path: '/admin/audit-logs', icon: 'file-text', label: 'Audit Logs', show: userIsFullAdmin },
          { path: '/admin/settings', icon: 'settings', label: 'Settings', show: hasPermission('manage_settings') },
        ],
      },
    ];
    return groups
      .map(g => ({ ...g, items: g.items.filter(i => i.show) }))
      .filter(g => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, JSON.stringify(permissions)]);

  const allItems = useMemo(() => navGroups.flatMap(g => g.items), [navGroups]);

  const isActive = useCallback((path) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  const currentItem = allItems.find(item => isActive(item.path));

  // Breadcrumb
  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length <= 2) return [{ label: currentItem?.label || 'Admin', path: location.pathname }];
    return [
      { label: currentItem?.label || parts[1], path: `/admin/${parts[1]}` },
      { label: parts.slice(2).join('/'), path: location.pathname },
    ];
  }, [location.pathname, currentItem]);

  const displayName = getUserDisplayName(user);
  const rawPhoto = getUserPhoto(user);
  const userPhoto = safeSrc(rawPhoto);
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(displayName);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed h-full z-40 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-300 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-zinc-800 flex-shrink-0">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
              <Car size={16} className="text-white" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sm text-white tracking-wide">LoopLane</span>
            )}
          </Link>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[4.5rem] w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors z-50"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={12} className="text-zinc-400" /> : <ChevronsLeft size={12} className="text-zinc-400" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4 scrollbar-hide">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICON_MAP[item.icon];
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-zinc-800 text-white font-medium'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                      )}
                    >
                      {Icon && <Icon size={18} className="flex-shrink-0" />}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="flex-shrink-0 border-t border-zinc-800 p-2 space-y-1">
          {!collapsed && (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
              >
                <ArrowLeft size={18} />
                <span>User Dashboard</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </>
          )}
          <div className="flex items-center gap-3 px-3 py-2">
            {userPhoto ? (
              <img src={userPhoto} alt={displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0', avatarColor)}>
                {initials}
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn('flex-1 transition-all duration-200', collapsed ? 'ml-16' : 'ml-60')}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Admin</span>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-zinc-300 dark:text-zinc-600">/</span>
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors outline-none">
              {userPhoto ? (
                <img src={userPhoto} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold', avatarColor)}>
                  {initials}
                </div>
              )}
              <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium hidden sm:inline">{displayName?.split(' ')[0]}</span>
              <ChevronDown size={14} className="text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User size={14} /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer">
                  <ArrowLeft size={14} /> User Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 cursor-pointer">
                <LogOut size={14} className="mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;