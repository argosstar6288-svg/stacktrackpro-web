'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem',
        }}>
          ⚠️
        </div>
        
        <h2 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '1rem',
        }}>
          Something went wrong!
        </h2>
        
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
          lineHeight: '1.6',
        }}>
          We encountered an unexpected error. This has been logged and we'll look into it.
        </p>

        {error.message && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '2rem',
            textAlign: 'left',
          }}>
            <p style={{
              color: '#991b1b',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              wordBreak: 'break-word',
            }}>
              {error.message}
            </p>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
        }}>
          <button
            onClick={reset}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#5568d3';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#667eea';
            }}
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              background: 'transparent',
              color: '#6b7280',
              border: '2px solid #e5e7eb',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            Go to Dashboard
          </button>
        </div>

        <p style={{
          marginTop: '2rem',
          fontSize: '0.875rem',
          color: '#9ca3af',
        }}>
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
