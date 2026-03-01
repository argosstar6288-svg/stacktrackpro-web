/**
 * ADMIN ACCESS CONTROL
 * 
 * SECURITY NOTICE: Only emails in this list have admin access.
 * DO NOT add any other emails without explicit authorization.
 * 
 * Admin user: argos.star6288@gmail.com (Shelbie)
 * Permissions: Full access to admin dashboard, all users, all data
 */

export const ADMIN_EMAILS = ["argos.star6288@gmail.com"];

export function isAdminEmail(email?: string | null) {
  if (!email) {
    console.log('[Admin Check] No email provided');
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const isAdmin = ADMIN_EMAILS.includes(normalizedEmail);
  
  console.log('[Admin Check] Email:', email, '| Normalized:', normalizedEmail, '| Is Admin:', isAdmin);
  
  return isAdmin;
}
