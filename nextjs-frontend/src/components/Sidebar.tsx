'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Database, Box, Zap, Cpu, Activity, Settings, LogOut, BookOpen, Wand2, Stethoscope, Tag, ClipboardList, ListChecks, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { label: 'Platform', items: [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/catalog', icon: BookOpen, label: 'Model Catalog' },
    { href: '/finetune', icon: Wand2, label: 'Fine-tune' },
    { href: '/datasets', icon: Database, label: 'Datasets' },
    { href: '/models', icon: Box, label: 'My Models' },
    { href: '/training', icon: Zap, label: 'Training Jobs' },
    { href: '/jobs', icon: ListChecks, label: 'All Jobs' },
  ]},
  { label: 'Medical', items: [
    { href: '/emr', icon: Stethoscope, label: 'EMR Workspace' },
    { href: '/emr/annotate', icon: Tag, label: 'Annotation' },
    { href: '/emr/cases', icon: ClipboardList, label: 'Case Explorer' },
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
  const isAdmin = (user as any)?.role === 'admin';

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

        {/* Admin section — only visible to admins */}
        {isAdmin && (
          <div>
            <div className="nav-section-label">Admin</div>
            <Link
              href="/admin"
              className={`nav-item${pathname === '/admin' ? ' active' : ''}`}
              style={{ color: pathname === '/admin' ? 'var(--warning)' : undefined }}
            >
              <ShieldCheck size={15} style={{ color: 'var(--warning)' }} />
              User Management
            </Link>
          </div>
        )}
      </nav>

      {user && (
        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: isAdmin ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#4f8ef7,#a78bfa)' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">
              {user.name}
              {isAdmin && <span style={{ fontSize: 9, color: 'var(--warning)', marginLeft: 4, fontWeight: 700 }}>ADMIN</span>}
            </div>
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
