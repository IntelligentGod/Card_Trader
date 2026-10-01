import type { ReactNode } from 'react';
import { getSession } from '../api';
import { href, paths } from '../router';

/** Super-admin pages render a clear notice for normal admins (the API answers 403 SUPER_ADMIN_ONLY anyway). */
export function SuperAdminOnly({ children }: { children: ReactNode }) {
  if (getSession()?.user.role === 'SUPER_ADMIN') return <>{children}</>;
  return (
    <div className="page">
      <div className="state state-empty super-only">
        <div>
          <strong>Super admin only</strong>
          <p>This page is available to the super admin account only.</p>
          <a href={href(paths.overview())}>Back to overview</a>
        </div>
      </div>
    </div>
  );
}
