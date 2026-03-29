import React from 'react';

export default class ErrorDumper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', border: '2px solid #ef4444' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Students Component Crashed!</h2>
          <p style={{ fontWeight: 'bold' }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ overflowX: 'auto', fontSize: '12px', marginTop: '10px' }}>
            {this.state.error && this.state.error.stack}
          </pre>
          <pre style={{ overflowX: 'auto', fontSize: '12px', marginTop: '10px' }}>
            {this.state.info && this.state.info.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
