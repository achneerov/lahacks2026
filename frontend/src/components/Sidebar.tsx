import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, type Role } from '../lib/api';

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  badgeKey?: 'unreadMessages';
};

const APPLICANT_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <HomeIcon />, end: true },
  { to: '/applicant/messages', label: 'Messages', icon: <ChatIcon />, badgeKey: 'unreadMessages' },
  { to: '/applicant/jobs', label: 'Job postings', icon: <BriefcaseIcon /> },
  { to: '/applicant/applications', label: 'Applications', icon: <ListIcon /> },
  { to: '/applicant/profile', label: 'Edit profile', icon: <UserIcon /> },
];

const RECRUITER_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <HomeIcon />, end: true },
  { to: '/recruiter/jobs', label: 'Job postings', icon: <BriefcaseIcon /> },
  { to: '/recruiter/messages', label: 'Messages', icon: <ChatIcon />, badgeKey: 'unreadMessages' },
];

function navForRole(role: Role | string): NavItem[] {
  if (role === 'Applicant') return APPLICANT_NAV;
  if (role === 'Recruiter') return RECRUITER_NAV;
  return [{ to: '/', label: 'Home', icon: <HomeIcon />, end: true }];
}

const POLL_INTERVAL_MS = 15000;
const UNREAD_REFRESH_EVENT = 'impulse:conversations-read-updated';

function useUnreadCount(role: Role | string | undefined, token: string | null) {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!token || !role) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const fetcher =
      role === 'Recruiter'
        ? () => api.recruiterConversations(token)
        : role === 'Applicant'
          ? () => api.applicantConversations(token)
          : null;
    if (!fetcher) {
      setCount(0);
      return;
    }

    const refresh = async () => {
      try {
        const { conversations } = await fetcher();
        if (cancelled) return;
        const unread = conversations.reduce((total, c) => {
          if (c.active !== 1) return total;
          const n = Number(c.unread_count ?? 0);
          return total + (Number.isFinite(n) && n > 0 ? n : 0);
        }, 0);
        setCount(unread);
      } catch {
        // Silent — badge isn't critical and shouldn't surface auth errors.
      }
    };

    void refresh();
    const onUnreadRefresh = () => {
      void refresh();
    };
    window.addEventListener(UNREAD_REFRESH_EVENT, onUnreadRefresh);
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.removeEventListener(UNREAD_REFRESH_EVENT, onUnreadRefresh);
      clearInterval(id);
    };
  }, [role, token, location.pathname]);

  return count;
}

export default function Sidebar() {
  const { user, token, logout } = useAuth();
  const nav = useNavigate();

  const items = user ? navForRole(user.role) : [];
  const unread = useUnreadCount(user?.role, token);

  return (
    <aside className="app-sidebar" style={styles.aside}>
      <div style={styles.brandRow}>
        <span style={styles.brandMark} aria-hidden="true">
          <span style={styles.brandRingMid} />
          <span style={styles.brandRingInner} />
        </span>
        <span style={styles.brandText}>Impulse</span>
      </div>

      <nav style={styles.nav} aria-label="Primary">
        {items.map((item) => {
          const badge =
            item.badgeKey === 'unreadMessages' && unread > 0 ? unread : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : null),
              })}
            >
              <span style={styles.navIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span style={styles.navLabel}>{item.label}</span>
              {badge > 0 && (
                <span style={styles.badge} aria-label={`${badge} unread`}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {user && (
        <div style={styles.footer}>
          <div style={styles.userBlock}>
            <span style={styles.userAvatar} aria-hidden="true">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <div style={styles.userMeta}>
              <span style={styles.userName}>{user.username}</span>
              <span style={styles.userRole}>{user.role}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={styles.logoutOverride}
            onClick={() => {
              logout();
              nav('/');
            }}
          >
            <span style={styles.navIcon} aria-hidden="true">
              <LogoutIcon />
            </span>
            <span>Log out</span>
          </button>
        </div>
      )}
    </aside>
  );
}

function iconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function HomeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 0 1-4.255-.949L3 20l1.395-3.72A7.9 7.9 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

const styles: Record<string, CSSProperties> = {
  aside: {
    width: 240,
    flexShrink: 0,
    boxSizing: 'border-box',
    padding: '24px 16px',
    borderRight: '1px solid var(--border)',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
    height: '100svh',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 8px',
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid #111111',
    color: '#111111',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    boxSizing: 'border-box',
  },
  brandRingMid: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid #111111',
    position: 'absolute',
    boxSizing: 'border-box',
  },
  brandRingInner: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    border: '2px solid #111111',
    position: 'absolute',
    boxSizing: 'border-box',
  },
  brandText: {
    fontSize: 16,
    fontWeight: 600,
    color: '#111111',
    letterSpacing: '-0.2px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minHeight: 0,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 999,
    fontSize: 14,
    color: 'var(--text)',
    textDecoration: 'none',
    transition: 'background 120ms ease, color 120ms ease',
  },
  navLabel: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 999,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: 0,
  },
  navItemActive: {
    background: '#EDE8D2',
    color: '#111111',
    fontWeight: 500,
  },
  navIcon: {
    display: 'inline-flex',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 8px',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: 'var(--accent)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-h)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: 12,
    color: 'var(--text)',
  },
  logoutOverride: {
    justifyContent: 'flex-start',
    gap: 10,
  },
};
