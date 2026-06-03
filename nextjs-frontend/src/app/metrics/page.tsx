export default function MetricsPage() {
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
