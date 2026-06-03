import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Database, Box, Cpu, Activity, Settings, LogOut, Zap
} from 'lucide-react';
import type { User } from '../types';

interface Props {
  user: User | null;
  onLogout: () => void;
}

const NAV = [
  { label: 'Platform', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/datasets', icon: Database, label: 'Datasets' },
    { to: '/models', icon: Box, label: 'Models' },
    { to: '/training', icon: Zap, label: 'Training Jobs' },
  ]},
  { label: 'Infrastructure', items: [
    { to: '/gpu-cluster', icon: Cpu, label: 'GPU Cluster' },
    { to: '/metrics', icon: Activity, label: 'Metrics' },
  ]},
  { label: 'Account', items: [
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]},
];

export default function Sidebar({ user, onLogout }: Props) {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">LF</div>
        <div>
          <span className="logo-text">LLM Forge</span>
          <span className="logo-badge">BETA</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((section) => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`nav-item${pathname === to ? ' active' : ''}`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {user && (
        <div className="sidebar-user">
          <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-plan">{user.plan} plan</div>
          </div>
          <button
            onClick={onLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
