/**
 * Notification System - Database Schema & Migration Guide
 * 
 * This file defines the database structure needed for the notification system
 * and provides migration/setup instructions.
 */

// ============================================================================
// COLLECTIONS & DOCUMENTS
// ============================================================================

/**
 * COLLECTION: notificationPreferences
 * 
 * Stores user notification preferences and settings
 * 
 * Document ID: {userId}
 * 
 * Schema:
 */
export interface NotificationPreferencesDoc {
  // User ID (document ID)
  userId: string;

  // Delivery channel preferences per notification type
  channels: Record<string, Array<'in-app' | 'email' | 'push'>>;
  // Example:
  // {
  //   "outbid": ["in-app", "email"],
  //   "auction_ending": ["in-app"],
  //   "item_sold": ["in-app", "email"],
  //   "payout_sent": ["in-app", "email"],
  //   "referral_reward": ["in-app", "email"],
  //   "security_alert": ["in-app", "email"],
  //   "promotional": [],
  // }

  // Disabled notification types (user has opted out)
  disabled: string[];
  // Example: ["promotional", "bidding_war"]

  // Quiet hours settings
  quietHours?: {
    enabled: boolean;
    startHour: number; // 0-23
    endHour: number; // 0-23
    timezone: string; // 'America/Chicago'
  };

  // Email digest settings
  digestPreferences?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly'; // 'never' when disabled
    dayOfWeek?: number; // 0-6 (Sun-Sat), only if weekly
    timeOfDay?: string; // HH:mm format, "09:00"
  };

  // User language preference
  language: string; // 'en', 'es', 'fr', etc.

  // User timezone
  timezone: string; // 'America/Chicago'

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * COLLECTION: notifications
 * 
 * Stores all notifications sent to users (for history/analytics)
 * 
 * Auto-generated document ID (recommended)
 * 
 * Schema:
 */
export interface NotificationDoc {
  // User who received the notification
  userId: string;

  // Notification metadata
  id: string; // Unique notification ID from template
  type: 'outbid' | 'auction_ending' | 'item_sold' | 'payout_sent' | 'referral_reward' | string;
  priority: 'high' | 'normal' | 'low';
  title: string;
  body: string;

  // Content
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;

  // Delivery channels
  deliveredVia: Array<'in-app' | 'email' | 'push'>;
  deliveredAt: Date;

  // Email specific
  emailSubject?: string;
  emailDeliveredAt?: Date;
  emailOpenedAt?: Date;
  emailClickedAt?: Date;
  emailBounced?: boolean;

  // In-app specific
  inAppSeenAt?: Date;
  inAppClickedAt?: Date;
  inAppDismissedAt?: Date;

  // Tracking
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  errorMessage?: string;
  retryCount: number;

  // Related entities (for filtering/analytics)
  relatedAuctionId?: string;
  relatedUserId?: string; // For referral notifications
  relatedPayoutId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * COLLECTION: notificationEvents
 * 
 * Tracks user interactions with notifications (clicks, opens, etc.)
 * Optimized for analytics queries
 * 
 * Auto-generated document ID (recommended)
 * 
 * Schema:
 */
export interface NotificationEventDoc {
  // References
  userId: string;
  notificationId: string;

  // Event information
  event: 'sent' | 'delivered' | 'opened' | 'clicked' | 'dismissed' | 'unsubscribed' | 'bounced';
  channel: 'in-app' | 'email' | 'push';
  notificationType: string;

  // Analytics
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  clientInfo?: {
    userAgent: string;
    ipAddress?: string; // Optional, may have privacy concerns
  };

  // Timestamps
  timestamp: Date;
  unixTimestamp: number; // For easier time-range queries

  // Related action (if user took action after notification)
  actionTaken?: string;
  actionTimestamp?: Date;
}

/**
 * COLLECTION: emailTemplates
 * 
 * Stores customizable email templates for each notification type
 * Separate from code templates for dynamic customization
 * 
 * Document ID: {notificationType}
 * 
 * Schema:
 */
export interface EmailTemplateDoc {
  // Template identity
  notificationType: string; // 'outbid', 'item_sold', etc.
  name: string;

  // Template content
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;

  // Variables used in template
  // Document how to use: {{ itemName }}, {{ buyerName }}, etc.
  variables: string[];

  // Version tracking
  version: number;
  isActive: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Admin user ID
  updatedBy?: string;
}

/**
 * COLLECTION: notificationSchedule
 * 
 * Stores scheduled notifications that need to be sent at future times
 * Used for auction ending reminders, digest emails, etc.
 * 
 * Auto-generated document ID (recommended)
 * 
 * Schema:
 */
export interface NotificationScheduleDoc {
  // Who to notify
  userId: string;

  // Notification details
  type: string;
  title: string;
  body: string;
  actionUrl?: string;

  // Scheduling
  scheduledForTime: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  lastRetryTime?: Date;

  // Related entities
  auctionId?: string;
  batchId?: string; // For batch operations

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// FIRESTORE INDEXES
// ============================================================================

/**
 * Recommended Firestore indexes for performance
 * 
 * Add these in Firebase Console > Firestore > Indexes
 */

export const RECOMMENDED_INDEXES = [
  {
    collection: 'notifications',
    fields: [
      { fieldPath: 'userId', order: 'Ascending' },
      { fieldPath: 'createdAt', order: 'Descending' },
    ],
    description: 'For querying user notification history',
  },
  {
    collection: 'notifications',
    fields: [
      { fieldPath: 'type', order: 'Ascending' },
      { fieldPath: 'status', order: 'Ascending' },
      { fieldPath: 'createdAt', order: 'Descending' },
    ],
    description: 'For analytics queries by notification type',
  },
  {
    collection: 'notificationEvents',
    fields: [
      { fieldPath: 'userId', order: 'Ascending' },
      { fieldPath: 'timestamp', order: 'Descending' },
    ],
    description: 'For user event history',
  },
  {
    collection: 'notificationEvents',
    fields: [
      { fieldPath: 'notificationType', order: 'Ascending' },
      { fieldPath: 'event', order: 'Ascending' },
      { fieldPath: 'timestamp', order: 'Descending' },
    ],
    description: 'For analytics by notification type and event',
  },
  {
    collection: 'notificationSchedule',
    fields: [
      { fieldPath: 'status', order: 'Ascending' },
      { fieldPath: 'scheduledForTime', order: 'Ascending' },
    ],
    description: 'For finding scheduled notifications to send',
  },
];

// ============================================================================
// SETUP INSTRUCTIONS
// ============================================================================

/**
 * Step 1: Create Collections
 * 
 * Run this in Firebase Console or use Firebase CLI:
 * 
 * firebase firestore:delete notificationPreferences --recursive
 * firebase firestore:delete notifications --recursive
 * firebase firestore:delete notificationEvents --recursive
 * firebase firestore:delete notificationSchedule --recursive
 * firebase firestore:delete emailTemplates --recursive
 */

/**
 * Step 2: Create Security Rules
 * 
 * In Firebase Console > Firestore > Rules, set:
 */
export const SECURITY_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow users to read/write only their own preferences
    match /notificationPreferences/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Allow users to read their notifications
    match /notifications/{notificationId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow write: if request.auth.uid == resource.data.userId;
    }
    
    // Allow users to create events for their own notifications
    match /notificationEvents/{eventId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow create: if request.auth.uid == request.resource.data.userId;
    }
    
    // Allow backend to manage schedules
    match /notificationSchedule/{scheduleId} {
      allow read, write: if request.auth.token.admin == true;
    }
    
    // Allow admins to manage templates
    match /emailTemplates/{templateId} {
      allow read: if true;
      allow write: if request.auth.token.admin == true;
    }
  }
}
`;

/**
 * Step 3: Initialize Default Preferences
 * 
 * When a user signs up, create their preferences:
 * 
 * async function createUserNotificationPreferences(userId: string) {
 *   const defaultPrefs = {
 *     userId,
 *     channels: {
 *       outbid: ['in-app', 'email'],
 *       auction_ending: ['in-app'],
 *       item_sold: ['in-app', 'email'],
 *       payout_sent: ['in-app', 'email'],
 *       referral_reward: ['in-app', 'email'],
 *       security_alert: ['in-app', 'email'],
 *       promotional: [],
 *     },
 *     disabled: ['promotional', 'bidding_war'],
 *     quietHours: {
 *       enabled: false,
 *       startHour: 21,
 *       endHour: 8,
 *       timezone: 'America/Chicago'
 *     },
 *     digestPreferences: {
 *       enabled: false,
 *       frequency: 'daily'
 *     },
 *     language: 'en',
 *     timezone: 'America/Chicago',
 *     createdAt: new Date(),
 *     updatedAt: new Date()
 *   };
 *   
 *   await db.collection('notificationPreferences').doc(userId).set(defaultPrefs);
 * }
 * 
 * Call this in your signup/onAuth flow
 */

/**
 * Step 4: Create Initial Email Templates (Optional)
 * 
 * Pre-populate emailTemplates collection with default templates
 * Or keep templates in code (current approach)
 */

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

/**
 * If migrating from an existing notification system:
 * 
 * 1. Backup existing notification data
 * 2. Export user preferences from old system
 * 3. Import into new notificationPreferences collection using scripts
 * 4. Verify data integrity
 * 5. Update notification triggers to use new system
 * 6. Deploy UI components
 * 7. Gradually roll out to users
 * 
 * Example migration script:
 * 
 * async function migratePreferences(oldData: any[]) {
 *   const batch = db.batch();
 *   
 *   for (const oldPref of oldData) {
 *     const newPref = {
 *       userId: oldPref.userId,
 *       channels: convertOldChannels(oldPref),
 *       disabled: oldPref.disabled || [],
 *       quietHours: oldPref.quietHours || { enabled: false },
 *       digestPreferences: oldPref.digest || { enabled: false },
 *       language: oldPref.language || 'en',
 *       timezone: oldPref.timezone || 'America/Chicago',
 *       createdAt: oldPref.createdAt || new Date(),
 *       updatedAt: new Date()
 *     };
 *     
 *     const ref = db.collection('notificationPreferences').doc(oldPref.userId);
 *     batch.set(ref, newPref);
 *   }
 *   
 *   await batch.commit();
 * }
 */

// ============================================================================
// BACKUP & EXPORT
// ============================================================================

/**
 * Backup notification data (run periodically):
 * 
 * firebase firestore:export gs://your-bucket/notifications-backup-2024-01-01/
 * 
 * Restore from backup:
 * 
 * firebase firestore:import gs://your-bucket/notifications-backup-2024-01-01/
 */

// ============================================================================
// DATA RETENTION & CLEANUP
// ============================================================================

/**
 * Recommended retention policies:
 * 
 * - notificationPreferences: Keep indefinitely (user settings)
 * - notifications: Keep for 90 days (analytics)
 * - notificationEvents: Keep for 90 days (analytics)
 * - notificationSchedule: Delete after status != 'pending' (after 7 days)
 * 
 * Example cleanup function (run via Cloud Scheduler):
 * 
 * export const cleanupOldNotifications = functions.pubsub
 *   .schedule('every day 03:00')
 *   .timeZone('America/Chicago')
 *   .onRun(async (context) => {
 *     const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
 *     
 *     const oldNotifications = await db.collection('notifications')
 *       .where('createdAt', '<', ninetyDaysAgo)
 *       .limit(1000)
 *       .get();
 *     
 *     const batch = db.batch();
 *     oldNotifications.docs.forEach(doc => batch.delete(doc.ref));
 *     await batch.commit();
 *   });
 */

// ============================================================================
// MONITORING & ALERTING
// ============================================================================

/**
 * Set up monitoring for:
 * 
 * 1. Notification delivery rate
 *    Alert if < 95% delivered in last hour
 * 
 * 2. Email bounce rate
 *    Alert if > 5% bounces
 * 
 * 3. Error rate
 *    Alert if > 1% failures
 * 
 * 4. Processing time
 *    Alert if average > 5 seconds
 * 
 * Example Firestore metrics query:
 * 
 * SELECT
 *   notification_type,
 *   COUNT(*) as total,
 *   COUNTIF(status = 'delivered') as delivered,
 *   ROUND(100 * COUNTIF(status = 'delivered') / COUNT(*), 2) as delivery_rate,
 *   AVG(DATE_DIFF(TIMESTAMP(deliveredAt), TIMESTAMP(createdAt), SECOND)) as avg_seconds
 * FROM notifications
 * WHERE createdAt > TIMESTAMP_SUB(NOW(), INTERVAL 1 HOUR)
 * GROUP BY notification_type
 */

export const DATABASE_SCHEMA_GUIDE = true;
