/**
 * Centralized role definitions.
 * Import from here instead of hardcoding role arrays in multiple files.
 */

const ADMIN_ROLES = [
    'ADMIN',
    'SUPER_ADMIN',
    'SUPPORT_AGENT',
    'FINANCE_MANAGER',
    'OPERATIONS_MANAGER',
    'CONTENT_MODERATOR',
    'FLEET_MANAGER'
];

const SUPER_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

module.exports = { ADMIN_ROLES, SUPER_ADMIN_ROLES };
