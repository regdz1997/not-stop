import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen" style={{ paddingTop: 'calc(var(--safe-top) + 40px)' }}>
        <div className="card">
          <h2>Algo salió mal</h2>
          <p className="muted small">Tus datos siguen guardados en el teléfono. Recarga la app; si se repite, anota este mensaje:</p>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', color: 'var(--danger)' }}>{String(this.state.error?.message ?? this.state.error)}</pre>
          <button className="btn" onClick={() => location.reload()}>Recargar</button>
        </div>
      </div>
    );
  }
}
