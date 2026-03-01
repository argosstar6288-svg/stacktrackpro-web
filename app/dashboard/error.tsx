'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div style={{
      padding: '3rem 2rem',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '1rem',
        }}>
          😕
        </div>
        
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '0.75rem',
        }}>
          Oops! Something went wrong
        </h2>
        
        <p style={{
          color: '#6b7280',
          marginBottom: '1.5rem',
          lineHeight: '1.5',
        }}>
          We encountered an issue loading this page.
        </p>

        {error.message && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            color: '#991b1b',
            fontFamily: 'monospace',
            textAlign: 'left',
            wordBreak: 'break-word',
          }}>
            {error.message}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={reset}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.625rem 1.25rem',
              borderRadius: '6px',
              fontSize: '0.9375rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              padding: '0.625rem 1.25rem',
              borderRadius: '6px',
              fontSize: '0.9375rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
