import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[eiayn] render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="status-screen">
        <div className="status-panel">
          <div className="brand-mark">AI</div>
          <h1>화면을 그리는 중 문제가 발생했습니다</h1>
          <p>일시적인 오류일 수 있습니다. 새로고침으로 다시 시도해주세요.</p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      </div>
    );
  }
}
