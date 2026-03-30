'use client';

import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

/**
 * Global error boundary — catches unhandled client-side exceptions
 * (including hydration failures from browser extensions like MetaMask SES lockdown)
 * and shows a graceful recovery UI instead of the generic Next.js crash page.
 */
export default class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ZION] Client error caught by boundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-black text-white">
          <div className="text-center max-w-lg space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">ZION TerraNova</h1>
            <p className="text-gray-400">
              Došlo k chybě při načítání stránky. Zkuste obnovit stránku nebo deaktivovat rozšíření prohlížeče (MetaMask, ad-blockery).
            </p>
            <p className="text-sm text-gray-600">
              A client-side error occurred. Try refreshing or disabling browser extensions.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-500 text-black font-semibold hover:opacity-90 transition"
            >
              Obnovit stránku
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
