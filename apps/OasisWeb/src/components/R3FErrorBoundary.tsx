'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label: string;
}
interface State {
  hasError: boolean;
}

/** R3F error boundary — if a component inside Canvas throws,
 *  it won't crash the whole render loop. */
export default class R3FErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[R3FErrorBoundary:${this.props.label}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
