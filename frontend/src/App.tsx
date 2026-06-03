import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Datasets from './pages/Datasets';
import Models from './pages/Models';
import Training from './pages/Training';
import GpuCluster from './pages/GpuCluster';
import Settings from './pages/Settings';
import Login from './pages/Login';
import api from './api/client';
import type { User } from './types';

function Metrics() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Metrics</div>
        <div className="page-subtitle">Advanced performance analytics — coming soon</div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="empty-state" style={{ padding: '80px 20px' }}>
            <div className="empty-state-icon" style={{ fontSize: 48 }}>📊</div>
            <div className="empty-state-text">Advanced metrics dashboard</div>
            <div className="empty-state-sub">TensorBoard integration, W&B export, and custom charts — coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg,#4f8ef7,#a78bfa)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 auto 12px' }}>LF</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading LLM Forge...</div>
          </div>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/models" element={<Models />} />
          <Route path="/training" element={<Training />} />
          <Route path="/gpu-cluster" element={<GpuCluster />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
