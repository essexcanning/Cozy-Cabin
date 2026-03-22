import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class GameErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GameCanvas Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-emerald-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-emerald-100 mb-4">Emergency Cabin Mode</h1>
          <p className="text-emerald-300 mb-8 max-w-md">
            The full cabin failed to load, but we've deployed the emergency shelter. 
            The game engine is still running in a simplified state.
          </p>
          <div className="w-32 h-32 bg-emerald-800 rounded-full flex items-center justify-center animate-pulse border-4 border-emerald-700">
             <div className="text-4xl">👤</div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            Try Full Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
