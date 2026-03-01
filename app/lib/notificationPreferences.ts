/**
 * Notification Preference Management
 * Handles user preferences for notifications, channels, quiet hours, and digests
 */

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CONFIGS,
  isValidChannel,
  isValidNotificationType,
  validatePreferences,
  type UserNotificationPreferences,
} from "./notificationConfig";

const PREFS_COLLECTION = "notificationPreferences";

// ============================================================================
// READ PREFERENCES
// ============================================================================

/**
 * Get user's notification preferences
 */
export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  try {
    const docRef = doc(collection(db, PREFS_COLLECTION), userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        userId,
        ...docSnap.data(),
      } as UserNotificationPreferences;
    }

    // Return defaults if not found
    return {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  } catch (error) {
    console.error(`Failed to get preferences for ${userId}:`, error);
    // Return defaults on error
    return {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }
}

/**
 * Check if user has notification type enabled
 */
export async function isNotificationEnabled(
  userId: string,
  notificationType: string
): Promise<boolean> {
  const prefs = await getUserNotificationPreferences(userId);
  return !prefs.disabled?.includes(notificationType);
}

/**
 * Get enabled channels for a notification type
 */
export async function getEnabledChannels(
  userId: string,
  notificationType: string
): Promise<Array<"in-app" | "email" | "push">> {
  if (!(await isNotificationEnabled(userId, notificationType))) {
    return [];
  }

  const prefs = await getUserNotificationPreferences(userId);
  return (
    prefs.channels[notificationType] ||
    NOTIFICATION_CONFIGS[notificationType]?.defaultChannels ||
    ["in-app"]
  );
}

/**
 * Check if user is in quiet hours
 */
export async function isUserInQuietHours(userId: string): Promise<boolean> {
  const prefs = await getUserNotificationPreferences(userId);

  if (!prefs.quietHours?.enabled) {
    return false;
  }

  const now = new Date();
  const hour = now.getHours();
  const start = prefs.quietHours.startHour;
  const end = prefs.quietHours.endHour;

  if (start < end) {
    return hour >= start && hour < end;
  } else {
    return hour >= start || hour < end;
  }
}

/**
 * Get all notification types for a user with their current settings
 */
export async function getAllNotificationsWithSettings(
  userId: string
): Promise<
  Array<{
    id: string;
    name: string;
    enabled: boolean;
    channels: Array<"in-app" | "email" | "push">;
    description: string;
  }>
> {
  const prefs = await getUserNotificationPreferences(userId);

  return Object.values(NOTIFICATION_CONFIGS).map((config) => ({
    id: config.id,
    name: config.name,
    description: config.description,
    enabled: !prefs.disabled?.includes(config.id),
    channels: prefs.channels[config.id] || config.defaultChannels,
  }));
}

// ============================================================================
// UPDATE PREFERENCES
// ============================================================================

/**
 * Update notification preferences for a user
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<UserNotificationPreferences>
): Promise<{ success: boolean; errors?: string[] }> {
  // Validate updates
  const errors = validatePreferences(updates);
  if (errors.length > 0) {
    return { success: false, errors };
  }

  try {
    const docRef = doc(collection(db, PREFS_COLLECTION), userId);

    // Get existing preferences
    const existing = await getUserNotificationPreferences(userId);

    // Merge updates
    const updated: UserNotificationPreferences = {
      ...existing,
      ...updates,
      userId,
    };

    // Save to database
    await setDoc(docRef, updated);

    return { success: true };
  } catch (error) {
    console.error(`Failed to update preferences for ${userId}:`, error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Enable a notification type
 */
export async function enableNotification(
  userId: string,
  notificationType: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidNotificationType(notificationType)) {
    return { success: false, error: "Invalid notification type" };
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const updated = {
      ...prefs,
      disabled: (prefs.disabled || []).filter((id) => id !== notificationType),
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disable a notification type
 */
export async function disableNotification(
  userId: string,
  notificationType: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidNotificationType(notificationType)) {
    return { success: false, error: "Invalid notification type" };
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const disabled = new Set(prefs.disabled || []);
    disabled.add(notificationType);

    const updated = {
      ...prefs,
      disabled: Array.from(disabled),
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update channels for a notification type
 */
export async function updateNotificationChannels(
  userId: string,
  notificationType: string,
  channels: Array<"in-app" | "email" | "push">
): Promise<{ success: boolean; error?: string }> {
  if (!isValidNotificationType(notificationType)) {
    return { success: false, error: "Invalid notification type" };
  }

  if (!channels.every(isValidChannel)) {
    return { success: false, error: "Invalid channel" };
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const updated = {
      ...prefs,
      channels: {
        ...prefs.channels,
        [notificationType]: channels,
      },
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update quiet hours
 */
export async function updateQuietHours(
  userId: string,
  enabled: boolean,
  startHour?: number,
  endHour?: number,
  timezone?: string
): Promise<{ success: boolean; error?: string }> {
  if (enabled) {
    if (
      startHour === undefined ||
      endHour === undefined ||
      typeof startHour !== "number" ||
      typeof endHour !== "number" ||
      startHour < 0 ||
      startHour > 23 ||
      endHour < 0 ||
      endHour > 23
    ) {
      return { success: false, error: "Invalid quiet hours" };
    }
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const updated = {
      ...prefs,
      quietHours: {
        enabled,
        startHour: startHour || prefs.quietHours?.startHour || 21,
        endHour: endHour || prefs.quietHours?.endHour || 8,
        timezone: timezone || prefs.quietHours?.timezone || "America/Chicago",
      },
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update digest preferences
 */
export async function updateDigestPreferences(
  userId: string,
  enabled: boolean,
  frequency?: "daily" | "weekly",
  dayOfWeek?: number,
  timeOfDay?: string
): Promise<{ success: boolean; error?: string }> {
  if (enabled && frequency === "weekly" && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
    return { success: false, error: "Invalid day of week" };
  }

  if (enabled && timeOfDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay)) {
    return { success: false, error: "Invalid time format (use HH:mm)" };
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const updated = {
      ...prefs,
      digestPreferences: {
        enabled,
        frequency: frequency || prefs.digestPreferences?.frequency || "daily",
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : prefs.digestPreferences?.dayOfWeek,
        timeOfDay: timeOfDay || prefs.digestPreferences?.timeOfDay,
      },
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferencesToDefaults(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const defaults = {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };

    const docRef = doc(collection(db, PREFS_COLLECTION), userId);
    await setDoc(docRef, defaults);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Enable multiple notification types
 */
export async function enableNotifications(
  userId: string,
  notificationTypes: string[]
): Promise<{ success: boolean; errors?: string[] }> {
  const invalidTypes = notificationTypes.filter((t) => !isValidNotificationType(t));

  if (invalidTypes.length > 0) {
    return { success: false, errors: [`Invalid types: ${invalidTypes.join(", ")}`] };
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const disabled = new Set(prefs.disabled || []);

    notificationTypes.forEach((type) => disabled.delete(type));

    const updated = {
      ...prefs,
      disabled: Array.from(disabled),
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Disable multiple notification types
 */
export async function disableNotifications(
  userId: string,
  notificationTypes: string[]
): Promise<{ success: boolean; errors?: string[] }> {
  const invalidTypes = notificationTypes.filter((t) => !isValidNotificationType(t));

  if (invalidTypes.length > 0) {
    return { success: false, errors: [`Invalid types: ${invalidTypes.join(", ")}`] };
  }

  try {
    const prefs = await getUserNotificationPreferences(userId);
    const disabled = new Set(prefs.disabled || []);

    notificationTypes.forEach((type) => disabled.add(type));

    const updated = {
      ...prefs,
      disabled: Array.from(disabled),
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

// ============================================================================
// UNSUBSCRIBE OPERATIONS
// ============================================================================

/**
 * Unsubscribe from a notification type via email link
 */
export async function unsubscribeViaLink(
  userId: string,
  notificationType: string
): Promise<{ success: boolean; error?: string }> {
  // Verify notification type is valid
  if (!isValidNotificationType(notificationType)) {
    return { success: false, error: "Invalid notification type" };
  }

  return disableNotification(userId, notificationType);
}

/**
 * Unsubscribe from all notifications except critical
 */
export async function unsubscribeFromAll(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const criticalNotifications = [
    "dispute_opened",
    "dispute_resolved",
    "security_alert",
    "payout_sent",
  ];

  try {
    const prefs = await getUserNotificationPreferences(userId);

    // Disable all except critical
    const disabled = Object.keys(NOTIFICATION_CONFIGS).filter(
      (t) => !criticalNotifications.includes(t)
    );

    const updated = {
      ...prefs,
      disabled,
    };

    await updateNotificationPreferences(userId, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// EXPORT PREFERENCES
// ============================================================================

/**
 * Export user preferences as JSON
 */
export async function exportPreferences(userId: string): Promise<string> {
  const prefs = await getUserNotificationPreferences(userId);
  return JSON.stringify(prefs, null, 2);
}

/**
 * Import preferences from JSON
 */
export async function importPreferences(
  userId: string,
  jsonData: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const imported = JSON.parse(jsonData);

    // Validate imported data
    const errors = validatePreferences(imported);
    if (errors.length > 0) {
      return { success: false, error: errors.join(", ") };
    }

    // Ensure userId matches
    const updated = { ...imported, userId };

    const docRef = doc(collection(db, PREFS_COLLECTION), userId);
    await setDoc(docRef, updated);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

/**
 * Get notification preference statistics for a user
 */
export async function getPreferenceStats(userId: string): Promise<{
  totalNotificationTypes: number;
  enabledTypes: number;
  disabledTypes: number;
  inAppChannelCount: number;
  emailChannelCount: number;
  pushChannelCount: number;
  quietHoursEnabled: boolean;
  digestEnabled: boolean;
}> {
  const prefs = await getUserNotificationPreferences(userId);

  const notificationTypes = Object.keys(NOTIFICATION_CONFIGS);
  const enabledTypes = notificationTypes.filter(
    (t) => !prefs.disabled?.includes(t)
  );
  const disabledTypes = notificationTypes.length - enabledTypes.length;

  let inAppCount = 0;
  let emailCount = 0;
  let pushCount = 0;

  Object.entries(prefs.channels || {}).forEach(([_, channels]) => {
    if (channels.includes("in-app")) inAppCount++;
    if (channels.includes("email")) emailCount++;
    if (channels.includes("push")) pushCount++;
  });

  return {
    totalNotificationTypes: notificationTypes.length,
    enabledTypes: enabledTypes.length,
    disabledTypes,
    inAppChannelCount: inAppCount,
    emailChannelCount: emailCount,
    pushChannelCount: pushCount,
    quietHoursEnabled: prefs.quietHours?.enabled || false,
    digestEnabled: prefs.digestPreferences?.enabled || false,
  };
}

/**
 * Get all users with a specific notification type enabled
 */
export async function getUsersWithNotificationEnabled(
  notificationType: string,
  channels?: Array<"in-app" | "email" | "push">
): Promise<string[]> {
  try {
    // Query all preference documents
    const q = query(
      collection(db, PREFS_COLLECTION),
      where(`disabled.${notificationType}`, "!=", true)
    );
    const snapshot = await getDocs(q);

    const userIds: string[] = [];

    snapshot.forEach((doc) => {
      const prefs = doc.data() as Partial<UserNotificationPreferences>;

      // If channels are specified, filter by those
      if (channels) {
        const notificationChannels = prefs.channels?.[notificationType] || [];
        const hasChannel = channels.some((ch) => notificationChannels.includes(ch));

        if (hasChannel) {
          userIds.push(doc.id);
        }
      } else {
        userIds.push(doc.id);
      }
    });

    return userIds;
  } catch (error) {
    console.error("Failed to query users:", error);
    return [];
  }
}

// ============================================================================
// TESTING HELPERS
// ============================================================================

/**
 * Test notification delivery with user preferences
 */
export async function testNotificationDelivery(
  userId: string,
  notificationType: string
): Promise<{
  canDeliver: boolean;
  enabled: boolean;
  inQuietHours: boolean;
  channels: Array<"in-app" | "email" | "push">;
  reasons: string[];
}> {
  const enabled = await isNotificationEnabled(userId, notificationType);
  const inQuietHours = await isUserInQuietHours(userId);
  const channels = await getEnabledChannels(userId, notificationType);

  const reasons: string[] = [];

  if (!enabled) {
    reasons.push(`Notification type "${notificationType}" is disabled`);
  }

  if (inQuietHours) {
    reasons.push("User is currently in quiet hours");
  }

  if (channels.length === 0) {
    reasons.push("No delivery channels enabled");
  }

  return {
    canDeliver: enabled && !inQuietHours && channels.length > 0,
    enabled,
    inQuietHours,
    channels,
    reasons,
  };
}
