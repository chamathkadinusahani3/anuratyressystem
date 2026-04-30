// ─── auth.ts — Central Role-Based Access Control ────────────────────────────
// Import this in every page that needs branch/role awareness.

export type UserRole = 'Super Admin' | 'Admin' | 'Manager' | 'Cashier';

export interface SessionUser {
  username: string;
  name: string;
  role: UserRole;
  branch: string; // 'All Branches' | 'Pannipitiya' | 'Ratnapura' | 'Kalawana' | 'Nivithigala'
}

// ── Branch names used across the app ────────────────────────────────────────
export const BRANCH_NAMES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'] as const;
export type BranchName = typeof BRANCH_NAMES[number];

// ── Roles that can see ALL branches ─────────────────────────────────────────
const ALL_BRANCH_ROLES: UserRole[] = ['Super Admin', 'Admin'];

// ── Which nav tabs each role can access ─────────────────────────────────────
//    'dashboard' is always visible to everyone.
const ROLE_ALLOWED_TABS: Record<UserRole, string[]> = {
  'Super Admin': ['dashboard', 'bookings', 'staff', 'inventory', 'customers', 'jobs', 'corporate-data', 'user-management', 'settings'],
  'Admin':       ['dashboard', 'bookings', 'staff', 'inventory', 'customers', 'jobs', 'corporate-data', 'settings'],
  'Manager':     ['dashboard', 'bookings', 'staff', 'inventory', 'customers', 'jobs', 'settings'],
  'Cashier':     ['dashboard', 'bookings', 'inventory', 'settings'],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem('at_user');
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function canSeeAllBranches(role: UserRole): boolean {
  return ALL_BRANCH_ROLES.includes(role);
}

/** Returns the branch filter value to apply for a given user.
 *  Super Admin / Admin → 'all'
 *  Everyone else       → their branch short name  */
export function getDefaultBranchFilter(user: SessionUser): string {
  return canSeeAllBranches(user.role) ? 'all' : user.branch;
}

/** Returns true if the given tab is accessible by the role. */
export function canAccessTab(role: UserRole, tab: string): boolean {
  return ROLE_ALLOWED_TABS[role]?.includes(tab) ?? false;
}

/** Returns the list of allowed tabs for sidebar rendering. */
export function getAllowedTabs(role: UserRole): string[] {
  return ROLE_ALLOWED_TABS[role] ?? ['dashboard'];
}

/** Normalises a booking's branch field so partial matches work reliably.
 *  Website bookings may store full branch name; manual bookings store shortName. */
export function bookingMatchesBranch(bookingBranch: string | undefined, filter: string): boolean {
  if (filter === 'all' || !filter) return true;
  if (!bookingBranch) return false;
  const b = bookingBranch.toLowerCase();
  return b === filter.toLowerCase() || b.includes(filter.toLowerCase());
}

/** Returns a human-readable label for a role badge. */
export function roleBadgeClass(role: UserRole): string {
  const map: Record<UserRole, string> = {
    'Super Admin': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    'Admin':       'bg-red-500/20 text-red-400 border border-red-500/30',
    'Manager':     'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    'Cashier':     'bg-green-500/20 text-green-400 border border-green-500/30',
  };
  return map[role] ?? 'bg-neutral-800 text-neutral-400 border border-neutral-700';
}