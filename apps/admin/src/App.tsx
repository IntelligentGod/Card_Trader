import { useSyncExternalStore } from 'react';
import { getSession, logout, subscribeSession } from './api';
import { Avatar, Badge, Empty } from './components';
import { AdminsPage } from './pages/AdminsPage';
import { AnnouncePage } from './pages/AnnouncePage';
import { AuditPage } from './pages/AuditPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { SuperAdminOnly } from './pages/SuperAdminOnly';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CardDetailPage } from './pages/CardDetailPage';
import { CardsPage } from './pages/CardsPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { TradeDetailPage } from './pages/TradeDetailPage';
import { TradesPage } from './pages/TradesPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UsersPage } from './pages/UsersPage';
import { href, paths, useLocation, type Route } from './router';

const NAV: { label: string; path: string; match: Route['name'][]; superOnly?: boolean }[] = [
  { label: 'Overview', path: paths.overview(), match: ['overview'] },
  { label: 'Users', path: paths.users(), match: ['users', 'user'] },
  { label: 'Trades', path: paths.trades(), match: ['trades', 'trade'] },
  { label: 'Catalog', path: paths.cards(), match: ['cards', 'card'] },
  { label: 'Analytics', path: paths.analytics(), match: ['analytics'] },
  { label: 'Admins', path: paths.admins(), match: ['admins'], superOnly: true },
  { label: 'Audit log', path: paths.audit(), match: ['audit'], superOnly: true },
  { label: 'Announcement', path: paths.announce(), match: ['announce'], superOnly: true },
];

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'overview':
      return <OverviewPage />;
    case 'users':
      return <UsersPage />;
    case 'user':
      return <UserDetailPage key={route.publicId} publicId={route.publicId} />;
    case 'trades':
      return <TradesPage />;
    case 'trade':
      return <TradeDetailPage key={route.id} id={route.id} />;
    case 'cards':
      return <CardsPage />;
    case 'card':
      return <CardDetailPage key={route.id} id={route.id} />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'admins':
      return <SuperAdminOnly><AdminsPage /></SuperAdminOnly>;
    case 'audit':
      return <SuperAdminOnly><AuditPage /></SuperAdminOnly>;
    case 'announce':
      return <SuperAdminOnly><AnnouncePage /></SuperAdminOnly>;
    case 'notFound':
      return (
        <div className="page">
          <Empty>
            Page not found. <a href={href(paths.overview())}>Go to overview</a>
          </Empty>
        </div>
      );
  }
}

export function App() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const { route } = useLocation();

  if (!session) return <LoginPage />;
  const { user } = session;
  if (user.mustChangePassword) return <ChangePasswordPage displayName={user.displayName} />;
  const isSuper = user.role === 'SUPER_ADMIN';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Card Trader <span>Admin</span>
        </div>
        <nav>
          {NAV.filter((n) => !n.superOnly || isSuper).map((n) => (
            <a key={n.path} href={href(n.path)} className={n.match.includes(route.name) ? 'active' : ''}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot small">Admin console</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-user">
            <Avatar url={user.avatarUrl} name={user.displayName} size={28} />
            <span>{user.displayName}</span>
            {isSuper && <Badge tone="red">Super admin</Badge>}
            <span className="muted small">{user.email}</span>
          </div>
          <button type="button" className="btn" onClick={() => void logout()}>
            Log out
          </button>
        </header>
        <main className="content">
          <Page route={route} />
        </main>
      </div>
    </div>
  );
}
