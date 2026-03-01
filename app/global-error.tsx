'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          padding: '2rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2.5rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem',
            }}>
              💥
            </div>
            
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '0.75rem',
            }}>
              Critical Error
            </h1>
            
            <p style={{
              color: '#6b7280',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
            }}>
              A critical error occurred. Please try refreshing the page.
            </p>

            {error.message && (
              <div style={{
                background: '#fee2e2',
                border: '2px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}>
                <p style={{
                  color: '#991b1b',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                  {error.message}
                </p>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <button
                onClick={reset}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
