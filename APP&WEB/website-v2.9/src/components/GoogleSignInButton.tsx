'use client';

/**
 * Google Sign-In button for ZIS.
 *
 * Loads the Google Identity Services script, initializes the sign-in client
 * with NEXT_PUBLIC_GOOGLE_CLIENT_ID, and calls onSuccess with the ID token.
 *
 * Falls back to a simple disabled state if the client ID is not configured.
 */

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: string;
            state_cookie_domain?: string;
            allowed_parent_origin?: string | string[];
            itp_support?: boolean;
            login_uri?: string;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            },
          ) => void;
          prompt: (moment?: 'signin' | 'signup') => void;
        };
      };
    };
  }
}

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: (error: Error) => void;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ onSuccess, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    if (document.getElementById('google-identity-services')) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => onError?.(new Error('Failed to load Google Identity Services'));
    document.body.appendChild(script);

    return () => {
      // Leave the script in place to avoid re-fetching; component unmount is fine.
    };
  }, [onError]);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.google || !CLIENT_ID) return;

    try {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          if (response?.credential) {
            onSuccess(response.credential);
          } else {
            onError?.(new Error('Google sign-in did not return a credential'));
          }
        },
        cancel_on_tap_outside: true,
        context: 'signin',
      });

      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
      });
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [scriptLoaded, onSuccess, onError]);

  if (!CLIENT_ID) {
    return (
      <div className="text-xs text-gray-500 text-center">
        Google sign-in is not configured.
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div ref={containerRef} style={{ minHeight: 44 }} />
    </div>
  );
}
