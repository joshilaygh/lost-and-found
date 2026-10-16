import React, { useEffect, useRef, useState } from 'react';

let googleScriptPromise;
let activeCallbacks = { onSuccess: null, onError: null };

export function disableGoogleAutoSelect() {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
}

function loadGoogleScript() {
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load gsi script')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load gsi script'));
    document.head.appendChild(s);
  });

  return googleScriptPromise;
}

/*
Props:
- onSuccess(resp)  -> receives the full GSI response object (resp.credential contains the ID token)
- onError(err)     -> optional
*/
export default function GoogleButton({ onSuccess, onError }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    activeCallbacks = { onSuccess, onError };
    console.log('GSI client id:', clientId, 'location.origin:', location.origin);

    if (!clientId) {
      const msg = 'VITE_GOOGLE_CLIENT_ID is not set. Check .env.development and restart dev server.';
      setErr(msg);
      if (onError) onError(new Error(msg));
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (!mounted) return;
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
          const msg = 'Google Identity library loaded but window.google.accounts.id is not available.';
          setErr(msg);
          if (onError) onError(new Error(msg));
          return;
        }

        try {
          const googleState = window.__lostFoundGoogleState || {};
          if (googleState.clientId !== clientId) {
            window.google.accounts.id.initialize({
              client_id: clientId,
              auto_select: false,
              callback: (resp) => {
                console.log('GSI callback response:', resp);
                if (resp && resp.credential) {
                  if (activeCallbacks.onSuccess) activeCallbacks.onSuccess(resp.credential);
                } else {
                  const msg = 'No credential received from Google.';
                  console.warn(msg, resp);
                  if (activeCallbacks.onError) activeCallbacks.onError(new Error(msg));
                }
              },
            });
            window.__lostFoundGoogleState = { clientId };
          }

          containerRef.current.replaceChildren();
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signin_with',
            width: 200,
          });

          // Google may inject an iframe wider than the requested button width.
          // Normalize it after each render so the click target matches our button.
          requestAnimationFrame(() => {
            const iframe = containerRef.current?.querySelector('iframe');
            if (iframe) {
              iframe.style.position = 'absolute';
              iframe.style.top = '0';
              iframe.style.left = '0';
              iframe.style.width = '100%';
              iframe.style.height = '44px';
              iframe.style.margin = '0';
            }
          });
          setReady(true);
        } catch (ex) {
          setErr(ex.message || String(ex));
          if (onError) onError(ex);
        }
      })
      .catch((ex) => {
        if (!mounted) return;
        setErr(ex.message || String(ex));
        if (onError) onError(ex);
      });

    return () => {
      mounted = false;
      containerRef.current?.replaceChildren();
    };
  }, [onSuccess, onError]);

  if (err) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <div style={{ color: 'crimson', fontWeight: 600, marginBottom: 8 }}>Google sign-in unavailable</div>
        <div style={{ color: '#111', marginBottom: 8 }}>{err}</div>
        <div style={{ fontSize: 13, color: '#444' }}>
          Common fixes: ensure <code>VITE_GOOGLE_CLIENT_ID</code> is set, and the client has <strong>{window.location.origin}</strong>
          under Authorized JavaScript origins in Google Cloud Console.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 360, minWidth: 200, position: 'relative', height: 44 }}>
      <button
        type="button"
        disabled={!ready}
        style={{
          width: '100%',
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '10px 16px',
          border: '1px solid #dadce0',
          borderRadius: 4,
          background: '#fff',
          color: '#3c4043',
          fontSize: 14,
          fontWeight: 600,
          cursor: ready ? 'pointer' : 'wait',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#EA4335" d="M17.64 9.2c0-.64-.06-1.26-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z" />
          <path fill="#4285F4" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.82.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.46.35 2.84.96 4.06l3.01-2.34Z" />
          <path fill="#34A853" d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.57-2.57C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34c.71-2.12 2.69-3.7 5.03-3.7Z" />
        </svg>
        Sign in with Google
      </button>
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 44,
          zIndex: 2,
          opacity: 0,
          overflow: 'hidden',
          cursor: ready ? 'pointer' : 'wait',
        }}
      />
      {!ready && <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>Loading sign-in…</div>}
    </div>
  );
}