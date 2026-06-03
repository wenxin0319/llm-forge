'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Database, Box, Zap, Cpu, Activity, Settings, LogOut, BookOpen, Wand2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { label: 'Platform', items: [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/catalog', icon: BookOpen, label: 'Model Catalog' },
    { href: '/finetune', icon: Wand2, label: 'Fine-tune' },
    { href: '/datasets', icon: Database, label: 'Datasets' },
    { href: '/models', icon: Box, label: 'My Models' },
    { href: '/training', icon: Zap, label: 'Training Jobs' },
  ]},
  { label: 'Infrastructure', items: [
    { href: '/gpu-cluster', icon: Cpu, label: 'GPU Cluster' },
    { href: '/metrics', icon: Activity, label: 'Metrics' },
  ]},
  { label: 'Account', items: [
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

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
            {section.items.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item${pathname === href || (href !== '/' && pathname.startsWith(href)) ? ' active' : ''}`}
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
            onClick={logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
