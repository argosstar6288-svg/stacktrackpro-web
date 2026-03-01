/**
 * Notification Settings Components
 * React components for user notification preference management
 * 
 * Usage: Import these components into your settings pages
 * Example: app/dashboard/settings/notifications/page.tsx
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { UserNotificationPreferences } from '../lib/notificationConfig';
import {
  getAllNotificationsWithSettings,
  updateNotificationChannels,
  enableNotification,
  disableNotification,
  updateQuietHours,
  updateDigestPreferences,
  resetPreferencesToDefaults,
  getPreferenceStats,
  testNotificationDelivery,
} from '../lib/notificationPreferences';

// ============================================================================
// NOTIFICATION TOGGLE COMPONENT
// ============================================================================

export interface NotificationToggleProps {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  channels: Array<'in-app' | 'email' | 'push'>;
  onToggle: (enabled: boolean) => Promise<void>;
  onChannelsChange: (channels: Array<'in-app' | 'email' | 'push'>) => Promise<void>;
}

/**
 * Individual notification type toggle with channel selector
 */
export const NotificationToggle: React.FC<NotificationToggleProps> = ({
  id,
  name,
  description,
  enabled,
  channels,
  onToggle,
  onChannelsChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onToggle(!enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelChange = async (channel: 'in-app' | 'email' | 'push') => {
    setIsLoading(true);
    setError(null);
    try {
      const newChannels = channels.includes(channel)
        ? channels.filter((c) => c !== channel)
        : [...channels, channel];
      await onChannelsChange(newChannels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="notification-toggle" style={{
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
      opacity: enabled ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '4px',
          }}>
            {name}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginBottom: '8px',
          }}>
            {description}
          </div>

          {/* Channel selectors */}
          {enabled && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {(['in-app', 'email', 'push'] as const).map((channel) => (
                <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={channels.includes(channel)}
                    onChange={() => handleChannelChange(channel)}
                    disabled={isLoading}
                    style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', color: '#374151' }}>
                    {channel === 'in-app' && '🔔 App'}
                    {channel === 'email' && '📧 Email'}
                    {channel === 'push' && '📲 Push'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Main toggle */}
        <button
          onClick={handleToggle}
          disabled={isLoading}
          style={{
            width: '48px',
            height: '24px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: enabled ? '#3b82f6' : '#d1d5db',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            opacity: isLoading ? 0.5 : 1,
          }}
          title={enabled ? 'Disable notification' : 'Enable notification'}
        />
      </div>

      {error && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#dc2626',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// NOTIFICATIONS LIST COMPONENT
// ============================================================================

export interface NotificationsListProps {
  userId: string;
}

/**
 * List of all notification types with toggles
 */
export const NotificationsList: React.FC<NotificationsListProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllNotificationsWithSettings(userId);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (notificationId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableNotification(userId, notificationId);
      } else {
        await disableNotification(userId, notificationId);
      }
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleChannelsChange = async (
    notificationId: string,
    channels: Array<'in-app' | 'email' | 'push'>
  ) => {
    try {
      await updateNotificationChannels(userId, notificationId, channels);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '16px', color: '#6b7280' }}>Loading notifications...</div>;
  }

  return (
    <div style={{ 
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {notifications.map((notification) => (
        <NotificationToggle
          key={notification.id}
          id={notification.id}
          name={notification.name}
          description={notification.description}
          enabled={notification.enabled}
          channels={notification.channels}
          onToggle={(enabled) => handleToggle(notification.id, !enabled)}
          onChannelsChange={(channels) => handleChannelsChange(notification.id, channels)}
        />
      ))}
    </div>
  );
};

// ============================================================================
// QUIET HOURS COMPONENT
// ============================================================================

export interface QuietHoursProps {
  userId: string;
}

/**
 * Quiet hours configuration component
 */
export const QuietHoursComponent: React.FC<QuietHoursProps> = ({ userId }) => {
  const [enabled, setEnabled] = useState(false);
  const [startHour, setStartHour] = useState(21);
  const [endHour, setEndHour] = useState(8);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateQuietHours(userId, enabled, startHour, endHour, timezone);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      marginTop: '20px',
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
        🌙 Quiet Hours
      </h3>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
        No notifications will be sent during these hours
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={isLoading}
        />
        <span style={{ fontSize: '14px', fontWeight: '500' }}>Enable quiet hours</span>
      </label>

      {enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
              Start Time
            </label>
            <input
              type="number"
              min="0"
              max="23"
              value={startHour}
              onChange={(e) => setStartHour(parseInt(e.target.value))}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
              End Time
            </label>
            <input
              type="number"
              min="0"
              max="23"
              value={endHour}
              onChange={(e) => setEndHour(parseInt(e.target.value))}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#dcfce7',
          color: '#166534',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          ✓ Quiet hours updated
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isLoading}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        {isLoading ? 'Saving...' : 'Save Quiet Hours'}
      </button>
    </div>
  );
};

// ============================================================================
// DIGEST PREFERENCES COMPONENT
// ============================================================================

export interface DigestPreferencesProps {
  userId: string;
}

/**
 * Email digest configuration component
 */
export const DigestPreferences: React.FC<DigestPreferencesProps> = ({ userId }) => {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateDigestPreferences(
        userId,
        enabled,
        enabled ? frequency : undefined,
        enabled && frequency === 'weekly' ? dayOfWeek : undefined,
        enabled ? timeOfDay : undefined
      );

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      marginTop: '20px',
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
        📧 Email Digest
      </h3>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
        Receive a summary of your notifications at a specific time
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={isLoading}
        />
        <span style={{ fontSize: '14px', fontWeight: '500' }}>Enable email digest</span>
      </label>

      {enabled && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              >
                {days.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
              Time of Day
            </label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#dcfce7',
          color: '#166534',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          ✓ Digest preferences updated
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isLoading}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        {isLoading ? 'Saving...' : 'Save Digest Preferences'}
      </button>
    </div>
  );
};

// ============================================================================
// NOTIFICATION SETTINGS PAGE
// ============================================================================

/**
 * Complete notification settings page component
 * Usage in: app/dashboard/settings/notifications/page.tsx
 */
export const NotificationSettingsPage: React.FC<{ userId: string }> = ({ userId }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetPreferencesToDefaults(userId);
      setShowResetConfirm(false);
      // Reload page to show updated preferences
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
        Notification Settings
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '32px' }}>
        Customize how and when you receive notifications about auctions, payouts, and more.
      </p>

      {/* Notification Types */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          📬 Notification Types
        </h2>
        <NotificationsList userId={userId} />
      </section>

      {/* Quiet Hours */}
      <section style={{ marginBottom: '32px' }}>
        <QuietHoursComponent userId={userId} />
      </section>

      {/* Digest Preferences */}
      <section style={{ marginBottom: '32px' }}>
        <DigestPreferences userId={userId} />
      </section>

      {/* Reset Button */}
      <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Reset to Default Settings
          </button>
        ) : (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '4px',
            borderLeft: '4px solid #f59e0b',
          }}>
            <p style={{ margin: 0, marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
              Reset to default settings?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleReset}
                disabled={isResetting}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default NotificationSettingsPage;
