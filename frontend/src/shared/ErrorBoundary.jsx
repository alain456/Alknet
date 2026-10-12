import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center p-8 text-center">
          <div>
            <h1 className="text-2xl font-bold text-ink mb-2">Une erreur est survenue</h1>
            <p className="text-ink-muted mb-6">Rechargez la page pour continuer.</p>
            <button
              type="button"
              className="bg-primary text-white font-semibold px-4 py-2 rounded-md"
              onClick={() => window.location.reload()}
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
