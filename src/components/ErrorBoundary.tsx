import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Tabletop Games ErrorBoundary caught error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-primary-bg select-none">
          <div className="bg-[#2a1a0e]/95 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 flex flex-col items-center gap-4 shadow-2xl max-w-md w-full text-center table-lifted backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner">
              🎲
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-amber-100 font-black text-lg sm:text-xl tracking-tight uppercase">
                Table Issue Encountered
              </h2>
              <p className="text-amber-200/80 text-xs sm:text-sm">
                Something went wrong setting up this tabletop. The board could not be initialized.
              </p>
            </div>

            <div className="flex items-center gap-2.5 mt-2 w-full">
              <button
                onClick={() => {
                  if (this.props.onReset) {
                    this.handleReset();
                  } else {
                    window.location.href = '/';
                  }
                }}
                type="button"
                className="flex-1 py-2.5 px-4 rounded-xl bg-container-dark hover:bg-stone-800 active:scale-95 text-accent-light font-bold text-xs uppercase tracking-wider shadow-md transition-all border border-stone-600"
              >
                Return to Menu
              </button>
              <button
                onClick={this.handleReset}
                type="button"
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-black text-xs uppercase tracking-wider shadow-md transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
