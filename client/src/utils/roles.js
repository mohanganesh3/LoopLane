export const ADMIN_PANEL_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'SUPPORT_AGENT',
  'FINANCE_MANAGER',
  'OPERATIONS_MANAGER',
  'CONTENT_MODERATOR',
  'FLEET_MANAGER'
]

export const FULL_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

const normalizeRole = (role) => (typeof role === 'string' ? role.toUpperCase() : '')

export const hasAdminPanelAccess = (role) => ADMIN_PANEL_ROLES.includes(normalizeRole(role))

export const isFullAdmin = (role) => FULL_ADMIN_ROLES.includes(normalizeRole(role))

export const getDefaultDashboardPath = (role) => (
  hasAdminPanelAccess(role) ? '/admin/dashboard' : '/dashboard'
)
