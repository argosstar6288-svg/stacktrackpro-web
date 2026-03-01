/**
 * Notification System Configuration
 * Central settings for notification types, priorities, delivery channels, and preferences
 */

export interface NotificationTypeConfig {
  id: string;
  name: string;
  description: string;
  category: "transaction" | "engagement" | "milestone" | "alert";
  defaultEnabled: boolean;
  defaultChannels: Array<"in-app" | "email" | "push">;
  defaultPriority: "high" | "normal" | "low";
  rateLimit?: {
    perHour?: number;
    perDay?: number;
  };
  batchable: boolean;
  requiresAuthentication: boolean;
}

// ============================================================================
// NOTIFICATION TYPE CONFIGURATIONS
// ============================================================================

export const NOTIFICATION_CONFIGS: Record<string, NotificationTypeConfig> = {
  // Outbid Notification
  outbid: {
    id: "outbid",
    name: "Outbid Alert",
    description: "Notifies user when their bid is exceeded",
    category: "alert",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "high",
    rateLimit: {
      perDay: 50, // Max 50 outbid notifications per day
    },
    batchable: true,
    requiresAuthentication: true,
  },

  // Auction Ending Soon Notification
  auction_ending: {
    id: "auction_ending",
    name: "Auction Ending Soon",
    description: "Reminds user about auctions ending (24h, 1h, 15m)",
    category: "engagement",
    defaultEnabled: true,
    defaultChannels: ["in-app"],
    defaultPriority: "normal",
    rateLimit: {
      perHour: 1, // Max 1 per auction per hour
    },
    batchable: true,
    requiresAuthentication: true,
  },

  // Item Sold Notification
  item_sold: {
    id: "item_sold",
    name: "Item Sold",
    description: "Notifies about auction results (win/loss)",
    category: "transaction",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "high",
    rateLimit: {
      perDay: 100, // Max 100 item sold notifications per day
    },
    batchable: true,
    requiresAuthentication: true,
  },

  // Payout Sent Notification
  payout_sent: {
    id: "payout_sent",
    name: "Payout Sent",
    description: "Confirms payment transferred to seller account",
    category: "transaction",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "high",
    batchable: false,
    requiresAuthentication: true,
  },

  // Referral Reward Notification
  referral_reward: {
    id: "referral_reward",
    name: "Referral Reward Earned",
    description: "Notifies about commission or milestone rewards",
    category: "milestone",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "normal",
    rateLimit: {
      perDay: 10, // Max 10 per day
    },
    batchable: false,
    requiresAuthentication: true,
  },

  // Additional notifications (for future expansion)
  bid_accepted: {
    id: "bid_accepted",
    name: "Bid Accepted",
    description: "Confirms bid was successfully placed",
    category: "transaction",
    defaultEnabled: true,
    defaultChannels: ["in-app"],
    defaultPriority: "normal",
    batchable: false,
    requiresAuthentication: true,
  },

  item_watched: {
    id: "item_watched",
    name: "Item Price Drop Alert",
    description: "Alerts when watched item price decreases",
    category: "engagement",
    defaultEnabled: false, // Opt-in by default
    defaultChannels: ["in-app", "email"],
    defaultPriority: "normal",
    batchable: true,
    requiresAuthentication: true,
  },

  seller_question: {
    id: "seller_question",
    name: "New Seller Question",
    description: "Someone asked a question about your item",
    category: "engagement",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "normal",
    rateLimit: {
      perDay: 50,
    },
    batchable: true,
    requiresAuthentication: true,
  },

  seller_rating: {
    id: "seller_rating",
    name: "New Seller Rating",
    description: "Someone left feedback on your account",
    category: "milestone",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "normal",
    batchable: true,
    requiresAuthentication: true,
  },

  buyer_feedback_request: {
    id: "buyer_feedback_request",
    name: "Request for Feedback",
    description: "Opens 3 days after purchase for buyer to leave feedback",
    category: "engagement",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "low",
    batchable: true,
    requiresAuthentication: true,
  },

  dispute_opened: {
    id: "dispute_opened",
    name: "Dispute Started",
    description: "A dispute has been opened about your transaction",
    category: "alert",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "high",
    batchable: false,
    requiresAuthentication: true,
  },

  dispute_resolved: {
    id: "dispute_resolved",
    name: "Dispute Resolved",
    description: "A dispute has been resolved",
    category: "transaction",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "high",
    batchable: false,
    requiresAuthentication: true,
  },

  bidding_war: {
    id: "bidding_war",
    name: "Bidding War Alert",
    description: "High activity on your watched items",
    category: "engagement",
    defaultEnabled: false, // Opt-in
    defaultChannels: ["in-app"],
    defaultPriority: "normal",
    batchable: true,
    requiresAuthentication: true,
  },

  security_alert: {
    id: "security_alert",
    name: "Security Alert",
    description: "Account security-related notifications",
    category: "alert",
    defaultEnabled: true,
    defaultChannels: ["in-app", "email"],
    defaultPriority: "high",
    batchable: false,
    requiresAuthentication: true,
  },

  promotional: {
    id: "promotional",
    name: "Promotions & Deals",
    description: "Special offers and platform promotions",
    category: "engagement",
    defaultEnabled: false, // Opt-in by default
    defaultChannels: ["email"],
    defaultPriority: "low",
    batchable: true,
    requiresAuthentication: false,
  },
};

// ============================================================================
// EMAIL TEMPLATE CONFIGURATION
// ============================================================================

export interface EmailConfig {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  logoUrl: string;
  brandColor: string;
  unsubscribeUrl: (userId: string, notificationType: string) => string;
  preferencesUrl: (userId: string) => string;
}

export const EMAIL_CONFIG: EmailConfig = {
  fromEmail: "notifications@stacktrackpro.com",
  fromName: "StackTrack Pro",
  replyTo: "support@stacktrackpro.com",
  logoUrl: "https://stacktrackpro.com/logo.png",
  brandColor: "#2563eb", // Blue
  unsubscribeUrl: (userId, type) =>
    `https://stacktrackpro.com/notifications/unsubscribe?user=${userId}&type=${type}`,
  preferencesUrl: (userId) =>
    `https://stacktrackpro.com/settings/notifications?user=${userId}`,
};

// ============================================================================
// NOTIFICATION DELIVERY CONFIGURATION
// ============================================================================

export interface DeliveryConfig {
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  batchSize: number;
  batchDelayMs: number;
}

export const DELIVERY_CONFIG: DeliveryConfig = {
  retryAttempts: 3,
  retryDelayMs: 5000, // 5 seconds between retries
  timeoutMs: 30000, // 30 seconds timeout
  batchSize: 100, // Max 100 notifications per batch
  batchDelayMs: 1000, // 1 second delay before sending batch
};

// ============================================================================
// NOTIFICATION FREQUENCY LIMITS
// ============================================================================

export const FREQUENCY_LIMITS = {
  // Per-user limits
  maxPerHour: 50,
  maxPerDay: 200,

  // Per-type limits (override defaults in NOTIFICATION_CONFIGS)
  perType: {
    outbid: { perDay: 50 },
    auction_ending: { perHour: 1 },
    item_sold: { perDay: 100 },
    seller_question: { perDay: 50 },
    promotional: { perDay: 1 },
  },

  // Cooling off period after high activity
  coolingOffPeriodMin: 30, // 30 minutes
  coolingOffThreshold: 10, // After 10 notifications
};

// ============================================================================
// NOTIFICATION PREFERENCES DEFAULTS
// ============================================================================

export interface UserNotificationPreferences {
  userId: string;
  channels: Record<string, Array<"in-app" | "email" | "push">>;
  disabled: string[]; // Array of notification IDs that are disabled
  quietHours?: {
    enabled: boolean;
    startHour: number; // 0-23
    endHour: number; // 0-23
    timezone: string;
  };
  digestPreferences?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "never";
    dayOfWeek?: number; // For weekly: 0-6 (Sun-Sat)
    timeOfDay?: string; // HH:mm format
  };
  language: string;
  timezone: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<UserNotificationPreferences, 'userId'> = {
  channels: {
    outbid: ["in-app", "email"],
    auction_ending: ["in-app"],
    item_sold: ["in-app", "email"],
    payout_sent: ["in-app", "email"],
    referral_reward: ["in-app", "email"],
    bid_accepted: ["in-app"],
    seller_question: ["in-app", "email"],
    seller_rating: ["in-app", "email"],
    buyer_feedback_request: ["in-app", "email"],
    dispute_opened: ["in-app", "email"],
    dispute_resolved: ["in-app", "email"],
    security_alert: ["in-app", "email"],
    promotional: [],
    bidding_war: [],
    item_watched: [],
  },
  disabled: ["promotional", "bidding_war"], // Opt-in notifications
  quietHours: {
    enabled: false,
    startHour: 21, // 9 PM
    endHour: 8, // 8 AM
    timezone: "America/Chicago",
  },
  digestPreferences: {
    enabled: false,
    frequency: "daily",
    dayOfWeek: 0,
    timeOfDay: "09:00",
  },
  language: "en",
  timezone: "America/Chicago",
};

// ============================================================================
// PRIORITY QUEUE CONFIGURATION
// ============================================================================

export const PRIORITY_QUEUE_CONFIG = {
  high: {
    weight: 1.0, // Highest priority
    maxDelay: 60000, // 1 minute max delay
  },
  normal: {
    weight: 0.5,
    maxDelay: 300000, // 5 minutes max delay
  },
  low: {
    weight: 0.1, // Lowest priority
    maxDelay: 3600000, // 1 hour max delay
  },
};

// ============================================================================
// ANALYTICS CONFIGURATION
// ============================================================================

export const ANALYTICS_CONFIG = {
  trackEvents: true,
  trackEngagement: true,
  trackDelivery: true,
  trackErrors: true,
  retentionDays: 90, // Keep analytics for 90 days
  samplingRate: 1.0, // 100% sampling (set to 0.1 for 10% sampling in production)
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all notification types
 */
export function getAllNotificationTypes(): string[] {
  return Object.keys(NOTIFICATION_CONFIGS);
}

/**
 * Get configuration for a specific notification type
 */
export function getNotificationConfig(type: string): NotificationTypeConfig | null {
  return NOTIFICATION_CONFIGS[type] || null;
}

/**
 * Check if a notification type is batchable
 */
export function isNotificationBatchable(type: string): boolean {
  const config = getNotificationConfig(type);
  return config?.batchable || false;
}

/**
 * Get default delivery channels for a notification type
 */
export function getDefaultChannels(
  type: string
): Array<"in-app" | "email" | "push"> {
  const config = getNotificationConfig(type);
  return config?.defaultChannels || ["in-app"];
}

/**
 * Get rate limit for a notification type
 */
export function getRateLimit(type: string): { perHour?: number; perDay?: number } | undefined {
  const config = getNotificationConfig(type);
  return config?.rateLimit;
}

/**
 * Check if a user has exceeded rate limit for a notification type
 */
export function hasExceededRateLimit(
  type: string,
  sentInLastHour: number,
  sentInLastDay: number
): boolean {
  const limit = getRateLimit(type);
  if (!limit) return false;

  if (limit.perHour && sentInLastHour >= limit.perHour) return true;
  if (limit.perDay && sentInLastDay >= limit.perDay) return true;

  return false;
}

/**
 * Get user preferences with defaults
 */
export function getDefaultUserPreferences(userId: string): UserNotificationPreferences {
  return {
    userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  };
}

/**
 * Check if user is in quiet hours
 */
export function isInQuietHours(
  preferences: UserNotificationPreferences,
  currentTime: Date = new Date()
): boolean {
  if (!preferences.quietHours?.enabled) return false;

  const hour = currentTime.getHours();
  const start = preferences.quietHours.startHour;
  const end = preferences.quietHours.endHour;

  if (start < end) {
    // Normal case (e.g., 9 AM - 5 PM)
    return hour >= start && hour < end;
  } else {
    // Wrap-around case (e.g., 9 PM - 8 AM)
    return hour >= start || hour < end;
  }
}

/**
 * Format email subject with smart truncation
 */
export function formatEmailSubject(subject: string, maxLength: number = 60): string {
  if (subject.length <= maxLength) return subject;
  return subject.substring(0, maxLength - 3) + "...";
}

/**
 * Generate email preview text
 */
export function generateEmailPreview(body: string, maxLength: number = 100): string {
  // Remove HTML tags
  const text = body.replace(/<[^>]*>/g, "");
  // Trim and truncate
  return text.trim().substring(0, maxLength);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate notification type
 */
export function isValidNotificationType(type: string): boolean {
  return type in NOTIFICATION_CONFIGS;
}

/**
 * Validate notification channels
 */
export function isValidChannel(channel: string): boolean {
  return ["in-app", "email", "push"].includes(channel);
}

/**
 * Validate priority
 */
export function isValidPriority(priority: string): boolean {
  return ["high", "normal", "low"].includes(priority);
}

/**
 * Validate user notification preferences
 */
export function validatePreferences(prefs: Partial<UserNotificationPreferences>): string[] {
  const errors: string[] = [];

  if (prefs.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(prefs.language)) {
    errors.push("Invalid language format");
  }

  if (prefs.quietHours) {
    if (
      typeof prefs.quietHours.startHour !== "number" ||
      prefs.quietHours.startHour < 0 ||
      prefs.quietHours.startHour > 23
    ) {
      errors.push("Invalid quiet hours start time");
    }
    if (
      typeof prefs.quietHours.endHour !== "number" ||
      prefs.quietHours.endHour < 0 ||
      prefs.quietHours.endHour > 23
    ) {
      errors.push("Invalid quiet hours end time");
    }
  }

  if (prefs.channels) {
    for (const [type, channels] of Object.entries(prefs.channels)) {
      if (!isValidNotificationType(type)) {
        errors.push(`Unknown notification type: ${type}`);
      }
      if (!Array.isArray(channels) || !channels.every(isValidChannel)) {
        errors.push(`Invalid channels for ${type}`);
      }
    }
  }

  return errors;
}
