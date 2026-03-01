/**
 * Notification Trigger Functions
 * High-level functions to trigger notifications with proper event tracking
 * Integrates with smartNotifications.ts for delivery and storage
 */

import {
  scheduleNotification,
  trackNotificationEvent,
  determineNotificationDelivery,
} from "./smartNotifications";
import {
  createOutbidNotification,
  createOutbidEmail,
  createAuctionEndingSoonNotification,
  createAuctionEndingSoonEmail,
  createItemSoldNotification,
  createItemSoldEmail,
  createPayoutSentNotification,
  createPayoutSentEmail,
  createReferralRewardNotification,
  createReferralRewardEmail,
  type NotificationTemplate,
  type EmailTemplate,
} from "./notificationTemplates";

/**
 * OUTBID NOTIFICATION TRIGGER
 * Call when a buyer's bid is exceeded in an ongoing auction
 */
export const triggerOutbidNotification = async (userId: string, data: {
  itemName: string;
  auctionId: string;
  currentBid: number;
  newBidAmount: number;
  timeRemaining: string;
  buyerName?: string;
  buyerEmail?: string;
}) => {
  const notification = createOutbidNotification(data);
  const email = createOutbidEmail({ ...data, recipientName: "Bidder" });

  return await scheduleNotificationWithTracking(userId, notification, email);
};

/**
 * AUCTION ENDING SOON NOTIFICATION TRIGGER
 * Call 24 hours, 1 hour, and 15 minutes before auction ends
 */
export const triggerAuctionEndingSoonNotification = async (
  userId: string,
  data: {
    itemName: string;
    auctionId: string;
    currentBid: number;
    timeRemaining: string;
    numericalHours: number; // 24, 1, or 0.25
    isWinning: boolean;
    userEmail?: string;
  }
) => {
  const notification = createAuctionEndingSoonNotification(data);
  const email = createAuctionEndingSoonEmail({ ...data, recipientName: "Bidder" });

  return await scheduleNotificationWithTracking(userId, notification, email, {
    sendEmail: data.numericalHours <= 1, // Only email for final hour and 15 min
  });
};

/**
 * ITEM SOLD NOTIFICATION TRIGGER
 * Call when an auction ends and item is sold
 */
export const triggerItemSoldNotification = async (userId: string, data: {
  itemName: string;
  auctionId: string;
  finalPrice: number;
  isWinner: boolean;
  sellerName?: string;
  userEmail?: string;
}) => {
  const notification = createItemSoldNotification(data);
  const email = createItemSoldEmail({ ...data, recipientName: "User" });

  return await scheduleNotificationWithTracking(userId, notification, email, {
    priority: data.isWinner ? "high" : "normal",
  });
};

/**
 * PAYOUT SENT NOTIFICATION TRIGGER
 * Call when seller's funds are transferred
 */
export const triggerPayoutSentNotification = async (
  userId: string,
  data: {
    amount: number;
    payoutMethod: string;
    transactionId: string;
    estimatedArrival: string;
    itemsSold?: number;
    netEarnings?: number;
    userEmail?: string;
  }
) => {
  const notification = createPayoutSentNotification(data);
  const email = createPayoutSentEmail({ ...data, recipientName: "Seller" });

  return await scheduleNotificationWithTracking(userId, notification, email, {
    priority: "high",
    sendEmail: true,
  });
};

/**
 * REFERRAL REWARD NOTIFICATION TRIGGER
 * Call when user earns referral commission or unlocks milestone
 */
export const triggerReferralRewardNotification = async (
  userId: string,
  data: {
    referredUserName: string;
    rewardAmount: number;
    rewardType: "commission" | "milestone" | "tier_bonus";
    milestoneLabel?: string;
    totalReferrals?: number;
    totalEarnings?: number;
    userEmail?: string;
  }
) => {
  const notification = createReferralRewardNotification(data);
  const email = createReferralRewardEmail({ ...data, recipientName: "Referrer" });

  return await scheduleNotificationWithTracking(userId, notification, email, {
    sendEmail: data.rewardType !== "commission", // Only email for milestones/tiers
  });
};

/**
 * INTERNAL HELPER: Schedule notification with email and tracking
 */
async function scheduleNotificationWithTracking(
  userId: string,
  notification: NotificationTemplate,
  email: EmailTemplate,
  options?: {
    priority?: "high" | "normal" | "low";
    sendEmail?: boolean;
  }
) {
  try {
    // Determine delivery channels based on user preferences
    const deliveryChannels = await determineNotificationDelivery({
      userId,
      type: notification.type as any,
      priority: notification.priority as any,
      title: notification.title,
      message: notification.body,
      data: { actionUrl: notification.actionUrl },
    });

    // Schedule in-app notification
    const notificationResult = await scheduleNotification({
      userId,
      type: notification.type as any,
      priority: notification.priority as any,
      title: notification.title,
      message: notification.body,
      data: { actionUrl: notification.actionUrl },
    });

    // Send email if enabled
    if (options?.sendEmail) {
      await sendEmailNotification(userId, email);
    }

    // Track notification event
    await trackNotificationEvent(userId, notification.id, "opened");

    return {
      success: true,
      notificationId: notification.id,
      channels: deliveryChannels,
    };
  } catch (error) {
    console.error(`Failed to trigger ${notification.type} notification:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * HELPER: Send email notification
 * In production, integrate with email service (SendGrid, Mailgun, etc.)
 */
async function sendEmailNotification(userId: string, email: EmailTemplate) {
  // TODO: Integrate with your email service
  // Example: await sendgrid.send({
  //   to: userEmail,
  //   from: 'notifications@stacktrackpro.com',
  //   subject: email.subject,
  //   html: email.htmlBody,
  //   text: email.textBody,
  // });

  console.log(`[EMAIL] ${email.subject}`);
  return {
    success: true,
    messageId: `email_${Date.now()}`,
  };
}

/**
 * BATCH NOTIFICATION TRIGGERS
 * For sending multiple notifications at once (e.g., daily auction ending soon emails)
 */

export const triggerBatchOutbidNotifications = async (
  auctions: Array<{
    bidderId: string;
    itemName: string;
    auctionId: string;
    currentBid: number;
    newBidAmount: number;
    timeRemaining: string;
  }>
) => {
  const results = await Promise.all(
    auctions.map((auction) =>
      triggerOutbidNotification(auction.bidderId, {
        itemName: auction.itemName,
        auctionId: auction.auctionId,
        currentBid: auction.currentBid,
        newBidAmount: auction.newBidAmount,
        timeRemaining: auction.timeRemaining,
      })
    )
  );

  return {
    total: auctions.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
};

export const triggerBatchAuctionEndingNotifications = async (
  auctions: Array<{
    watcherId: string;
    itemName: string;
    auctionId: string;
    currentBid: number;
    timeRemaining: string;
    numericalHours: number;
    isWinning: boolean;
  }>
) => {
  const results = await Promise.all(
    auctions.map((auction) =>
      triggerAuctionEndingSoonNotification(auction.watcherId, {
        itemName: auction.itemName,
        auctionId: auction.auctionId,
        currentBid: auction.currentBid,
        timeRemaining: auction.timeRemaining,
        numericalHours: auction.numericalHours,
        isWinning: auction.isWinning,
      })
    )
  );

  return {
    total: auctions.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
};

/**
 * NOTIFICATION SCHEDULING
 * For recurring notifications (auction ending soon at specific intervals)
 */

export const scheduleAuctionEndingNotifications = async (
  auctionId: string,
  auctionEndTime: Date,
  watcherIds: string[]
) => {
  const now = new Date();
  const timeUntilEnd = auctionEndTime.getTime() - now.getTime();

  const notifications = [];

  // Schedule 24-hour notification
  if (timeUntilEnd > 24 * 60 * 60 * 1000) {
    const notificationTime = new Date(auctionEndTime.getTime() - 24 * 60 * 60 * 1000);
    notifications.push({
      time: notificationTime,
      numericalHours: 24,
      timeRemaining: "in 24 hours",
    });
  }

  // Schedule 1-hour notification
  if (timeUntilEnd > 60 * 60 * 1000) {
    const notificationTime = new Date(auctionEndTime.getTime() - 60 * 60 * 1000);
    notifications.push({
      time: notificationTime,
      numericalHours: 1,
      timeRemaining: "in 1 hour",
    });
  }

  // Schedule 15-minute notification
  if (timeUntilEnd > 15 * 60 * 1000) {
    const notificationTime = new Date(auctionEndTime.getTime() - 15 * 60 * 1000);
    notifications.push({
      time: notificationTime,
      numericalHours: 0.25,
      timeRemaining: "in 15 minutes",
    });
  }

  return {
    auctionId,
    scheduledCount: notifications.length,
    notifications,
  };
};

/**
 * NOTIFICATION PREFERENCES
 * Check if user wants to receive specific notification types
 */

export const shouldSendNotification = async (
  userId: string,
  notificationType: "outbid" | "auction_ending" | "item_sold" | "payout_sent" | "referral_reward"
): Promise<boolean> => {
  // TODO: Query user notification preferences from database
  // Check if user has disabled this notification type

  // For now, send all notifications
  return true;
};

/**
 * NOTIFICATION HISTORY
 * Get recent notifications for a user
 */

export const getNotificationHistory = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
) => {
  // TODO: Query notification history from database
  // Return recent notifications for user

  return {
    userId,
    notifications: [],
    total: 0,
    hasMore: false,
  };
};
