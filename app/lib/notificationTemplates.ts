/**
 * Notification Templates and Generators
 * Handles creation and formatting of specific notification types
 */

export interface NotificationTemplate {
  id: string;
  title: string;
  body: string;
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: "low" | "normal" | "high";
  type: "outbid" | "auction_ending" | "item_sold" | "payout_sent" | "referral_reward";
}

export interface EmailTemplate {
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
}

/**
 * OUTBID NOTIFICATION
 * Sent when user's bid is exceeded in an active auction
 */
export const createOutbidNotification = (data: {
  itemName: string;
  auctionId: string;
  currentBid: number;
  newBidAmount: number;
  timeRemaining: string;
  buyerName?: string;
}): NotificationTemplate => ({
  id: `outbid_${data.auctionId}`,
  title: "You've been outbid!",
  body: `${data.buyerName || "Another bidder"} placed a bid of $${data.newBidAmount.toFixed(2)} on "${data.itemName}". ${data.timeRemaining} remaining.`,
  icon: "⬆️",
  actionUrl: `/auction/${data.auctionId}`,
  actionLabel: "Place New Bid",
  priority: "high",
  type: "outbid",
});

export const createOutbidEmail = (data: {
  itemName: string;
  auctionId: string;
  currentBid: number;
  newBidAmount: number;
  timeRemaining: string;
  buyerName?: string;
  recipientName: string;
}): EmailTemplate => ({
  subject: `You've been outbid on "${data.itemName}"`,
  preheader: `New bid of $${data.newBidAmount.toFixed(2)} on your item`,
  textBody: `
Hi ${data.recipientName},

You've been outbid! ${data.buyerName || "Another bidder"} just placed a bid of $${data.newBidAmount.toFixed(2)} on "${data.itemName}".

Current Price: $${data.newBidAmount.toFixed(2)}
Time Remaining: ${data.timeRemaining}

Place a new bid now to stay in the running!

View Auction: https://stacktrackpro.com/auction/${data.auctionId}

Best regards,
StackTrackPro Team
  `,
  htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been outbid</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #d9534f; margin-bottom: 16px;">⬆️ You've Been Outbid</h1>
    <p style="font-size: 16px;">Hi ${data.recipientName},</p>
    
    <p>Another bidder just surpassed your offer on this item you were watching!</p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #0066cc;">${data.itemName}</h3>
      <p style="margin: 8px 0;"><strong>New Highest Bid:</strong> $${data.newBidAmount.toFixed(2)}</p>
      <p style="margin: 8px 0;"><strong>Bidder:</strong> ${data.buyerName || "Anonymous"}</p>
      <p style="margin: 8px 0;"><strong>Time Remaining:</strong> ${data.timeRemaining}</p>
    </div>
    
    <p>Place a new bid now to stay competitive!</p>
    
    <a href="https://stacktrackpro.com/auction/${data.auctionId}" style="display: inline-block; background-color: #d9534f; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      Place New Bid
    </a>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">If you no longer wish to bid on this item, you can remove it from your watchlist.</p>
  </div>
</body>
</html>
  `,
});

/**
 * AUCTION ENDING SOON NOTIFICATION
 * Sent 24 hours, 1 hour, and 15 minutes before auction ends
 */
export const createAuctionEndingSoonNotification = (data: {
  itemName: string;
  auctionId: string;
  currentBid: number;
  timeRemaining: string;
  numericalHours: number; // 24, 1, or 0.25
  isWinning: boolean;
}): NotificationTemplate => {
  const statusText = data.isWinning ? "You're currently winning!" : "Don't miss out!";
  return {
    id: `ending_soon_${data.auctionId}_${data.numericalHours}`,
    title: `Auction ending ${data.timeRemaining}`,
    body: `"${data.itemName}" - Current: $${data.currentBid.toFixed(2)}. ${statusText}`,
    icon: "⏱️",
    actionUrl: `/auction/${data.auctionId}`,
    actionLabel: data.isWinning ? "View Auction" : "Place Bid",
    priority: data.numericalHours === 0.25 ? "high" : "normal",
    type: "auction_ending",
  };
};

export const createAuctionEndingSoonEmail = (data: {
  itemName: string;
  auctionId: string;
  currentBid: number;
  timeRemaining: string;
  numericalHours: number;
  isWinning: boolean;
  recipientName: string;
}): EmailTemplate => {
  const statusHtml = data.isWinning
    ? `<p style="color: #28a745; font-weight: bold;">✓ You're currently the highest bidder!</p>`
    : `<p style="color: #ff9800; font-weight: bold;">⚠️ Place your bid before it's too late!</p>`;

  return {
    subject: `Auction ending ${data.timeRemaining} - "${data.itemName}"`,
    preheader: `Don't miss out on "${data.itemName}" - ${data.timeRemaining} left`,
    textBody: `
Hi ${data.recipientName},

The auction for "${data.itemName}" is ending ${data.timeRemaining}!

Current Bid: $${data.currentBid.toFixed(2)}
${data.isWinning ? "Status: You're winning!" : "Status: Place your bid now!"}

View the auction: https://stacktrackpro.com/auction/${data.auctionId}

Best regards,
StackTrackPro Team
    `,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Ending Soon</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #ff9800; margin-bottom: 16px;">⏱️ Auction Ending ${data.timeRemaining}</h1>
    <p style="font-size: 16px;">Hi ${data.recipientName},</p>
    
    <p>Don't miss out! The auction you're interested in is ending soon.</p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #0066cc;">${data.itemName}</h3>
      <p style="margin: 8px 0;"><strong>Current Bid:</strong> $${data.currentBid.toFixed(2)}</p>
      <p style="margin: 8px 0;"><strong>Time Remaining:</strong> ${data.timeRemaining}</p>
      ${statusHtml}
    </div>
    
    <p>Act now to secure this item!</p>
    
    <a href="https://stacktrackpro.com/auction/${data.auctionId}" style="display: inline-block; background-color: #ff9800; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      View Auction
    </a>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
  </div>
</body>
</html>
    `,
  };
};

/**
 * ITEM SOLD NOTIFICATION
 * Sent to winning bidder when auction ends
 */
export const createItemSoldNotification = (data: {
  itemName: string;
  auctionId: string;
  finalPrice: number;
  isWinner: boolean;
}): NotificationTemplate => {
  const titleText = data.isWinner ? "You won!" : "Auction ended";
  const bodyText = data.isWinner
    ? `Congratulations! You won "${data.itemName}" for $${data.finalPrice.toFixed(2)}.`
    : `"${data.itemName}" sold for $${data.finalPrice.toFixed(2)}.`;

  return {
    id: `sold_${data.auctionId}`,
    title: titleText,
    body: bodyText,
    icon: data.isWinner ? "🎉" : "🔨",
    actionUrl: `/dashboard/portfolio`,
    actionLabel: data.isWinner ? "View Purchase" : "View Details",
    priority: data.isWinner ? "high" : "normal",
    type: "item_sold",
  };
};

export const createItemSoldEmail = (data: {
  itemName: string;
  auctionId: string;
  finalPrice: number;
  isWinner: boolean;
  recipientName: string;
  sellerName?: string;
}): EmailTemplate => {
  if (data.isWinner) {
    return {
      subject: `Congratulations! You won "${data.itemName}"`,
      preheader: `You won the auction for $${data.finalPrice.toFixed(2)}`,
      textBody: `
Hi ${data.recipientName},

Congratulations! You've won the auction for "${data.itemName}"!

Final Price: $${data.finalPrice.toFixed(2)}
Seller: ${data.sellerName || "StackTrackPro Seller"}

Next Steps:
1. Complete payment
2. Provide shipping address
3. Seller will ship within 2 business days

View your purchase: https://stacktrackpro.com/dashboard/portfolio

Best regards,
StackTrackPro Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You Won!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #28a745; margin-bottom: 16px;">🎉 Congratulations! You Won!</h1>
    <p style="font-size: 16px;">Hi ${data.recipientName},</p>
    
    <p>Great news! Your bid was the highest. You've won the auction!</p>
    
    <div style="background-color: #f0f7f0; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #28a745;">
      <h3 style="margin-top: 0; color: #0066cc;">${data.itemName}</h3>
      <p style="margin: 8px 0;"><strong>Final Price:</strong> $${data.finalPrice.toFixed(2)}</p>
      <p style="margin: 8px 0;"><strong>Seller:</strong> ${data.sellerName || "StackTrackPro Seller"}</p>
    </div>
    
    <h3>Next Steps:</h3>
    <ol style="color: #666;">
      <li>Complete your payment</li>
      <li>Provide your shipping address</li>
      <li>Sit back and wait for delivery (2-7 business days typically)</li>
    </ol>
    
    <a href="https://stacktrackpro.com/dashboard/portfolio" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      Complete Purchase
    </a>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">Questions? Contact the seller or our support team.</p>
  </div>
</body>
</html>
      `,
    };
  } else {
    // Losing bidder
    return {
      subject: `Auction ended for "${data.itemName}"`,
      preheader: `Final price: $${data.finalPrice.toFixed(2)}`,
      textBody: `
Hi ${data.recipientName},

The auction for "${data.itemName}" has ended. Unfortunately, the final price was $${data.finalPrice.toFixed(2)}.

Better luck next time! Check out similar items: https://stacktrackpro.com/dashboard/discover

Best regards,
StackTrackPro Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Ended</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #666; margin-bottom: 16px;">🔨 Auction Ended</h1>
    <p style="font-size: 16px;">Hi ${data.recipientName},</p>
    
    <p>The auction for "${data.itemName}" has ended.</p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #0066cc;">${data.itemName}</h3>
      <p style="margin: 8px 0;"><strong>Final Price:</strong> $${data.finalPrice.toFixed(2)}</p>
    </div>
    
    <p>Don't worry! There are many more items to bid on. Check out similar items in your favorite categories.</p>
    
    <a href="https://stacktrackpro.com/dashboard/discover" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      Discover More Items
    </a>
  </div>
</body>
</html>
      `,
    };
  }
};

/**
 * PAYOUT SENT NOTIFICATION
 * Sent to seller when funds are transferred to their account
 */
export const createPayoutSentNotification = (data: {
  amount: number;
  payoutMethod: string;
  transactionId: string;
  estimatedArrival: string;
}): NotificationTemplate => ({
  id: `payout_${data.transactionId}`,
  title: "Payout sent!",
  body: `$${data.amount.toFixed(2)} has been transferred to your ${data.payoutMethod}. Arriving ${data.estimatedArrival}.`,
  icon: "💰",
  actionUrl: `/dashboard/settings?tab=payouts`,
  actionLabel: "View Details",
  priority: "high",
  type: "payout_sent",
});

export const createPayoutSentEmail = (data: {
  amount: number;
  payoutMethod: string;
  transactionId: string;
  estimatedArrival: string;
  recipientName: string;
  itemsSold?: number;
  netEarnings?: number;
}): EmailTemplate => ({
  subject: `Payout sent: $${data.amount.toFixed(2)}`,
  preheader: `Your earnings of $${data.amount.toFixed(2)} are on the way`,
  textBody: `
Hi ${data.recipientName},

Great news! Your payout has been processed and sent.

Payout Amount: $${data.amount.toFixed(2)}
Destination: ${data.payoutMethod}
Transaction ID: ${data.transactionId}
Estimated Arrival: ${data.estimatedArrival}

${data.itemsSold ? `Items Sold This Period: ${data.itemsSold}` : ""}
${data.netEarnings ? `Net Earnings: $${data.netEarnings.toFixed(2)}` : ""}

Track your payouts: https://stacktrackpro.com/dashboard/settings

Best regards,
StackTrackPro Team
  `,
  htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payout Sent</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #28a745; margin-bottom: 16px;">💰 Payout Sent!</h1>
    <p style="font-size: 16px;">Hi ${data.recipientName},</p>
    
    <p>Your earnings have been successfully transferred to your account.</p>
    
    <div style="background-color: #f0f7f0; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #28a745;">
      <p style="margin: 8px 0;"><strong>Amount:</strong> $${data.amount.toFixed(2)}</p>
      <p style="margin: 8px 0;"><strong>Method:</strong> ${data.payoutMethod}</p>
      <p style="margin: 8px 0;"><strong>Transaction ID:</strong> ${data.transactionId}</p>
      <p style="margin: 8px 0;"><strong>Expected Arrival:</strong> ${data.estimatedArrival}</p>
      ${data.itemsSold ? `<p style="margin: 8px 0;"><strong>Items Sold:</strong> ${data.itemsSold}</p>` : ""}
      ${data.netEarnings ? `<p style="margin: 8px 0;"><strong>Net Earnings:</strong> $${data.netEarnings.toFixed(2)}</p>` : ""}
    </div>
    
    <p>Keep an eye on your account for any updates. If the funds don't arrive by the estimated date, please contact support.</p>
    
    <a href="https://stacktrackpro.com/dashboard/settings" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      View Payout History
    </a>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">Questions? Check our payout FAQ or contact support.</p>
  </div>
</body>
</html>
  `,
});

/**
 * REFERRAL REWARD UNLOCKED NOTIFICATION
 * Sent when user earns referral commission or unlocks milestone reward
 */
export const createReferralRewardNotification = (data: {
  referredUserName: string;
  rewardAmount: number;
  rewardType: "commission" | "milestone" | "tier_bonus";
  milestoneLabel?: string; // e.g., "5 Referrals", "$100 in Sales"
  totalReferrals?: number;
}): NotificationTemplate => {
  let titleText = "Referral reward earned!";
  let bodyText = "";

  switch (data.rewardType) {
    case "commission":
      titleText = "You earned a referral commission!";
      bodyText = `${data.referredUserName} made a purchase. You've earned $${data.rewardAmount.toFixed(2)}!`;
      break;
    case "milestone":
      titleText = `🎯 Milestone unlocked: ${data.milestoneLabel}`;
      bodyText = `Congratulations! You've earned a bonus reward of $${data.rewardAmount.toFixed(2)}.`;
      break;
    case "tier_bonus":
      titleText = "Tier bonus unlocked!";
      bodyText = `Your referral network reached a new milestone! Earn $${data.rewardAmount.toFixed(2)}.`;
      break;
  }

  return {
    id: `referral_${data.rewardType}_${Date.now()}`,
    title: titleText,
    body: bodyText,
    icon: "🎉",
    actionUrl: `/dashboard/referral-leaderboard`,
    actionLabel: "View Referrals",
    priority: "normal",
    type: "referral_reward",
  };
};

export const createReferralRewardEmail = (data: {
  referredUserName: string;
  rewardAmount: number;
  rewardType: "commission" | "milestone" | "tier_bonus";
  milestoneLabel?: string;
  totalReferrals?: number;
  totalEarnings?: number;
  recipientName: string;
}): EmailTemplate => {
  let subject = "";
  let bodyIntro = "";

  switch (data.rewardType) {
    case "commission":
      subject = `You earned $${data.rewardAmount.toFixed(2)} in referral commission!`;
      bodyIntro = `${data.referredUserName} just made their first purchase on StackTrackPro. Thanks for the referral!`;
      break;
    case "milestone":
      subject = `🎯 Milestone unlocked: ${data.milestoneLabel}`;
      bodyIntro = `You've hit a milestone in your referral network! Congratulations on reaching ${data.milestoneLabel}.`;
      break;
    case "tier_bonus":
      subject = `New tier bonus: $${data.rewardAmount.toFixed(2)}`;
      bodyIntro = `Your referral network has grown! You've unlocked a new tier bonus.`;
      break;
  }

  return {
    subject,
    preheader: `Great news! You earned $${data.rewardAmount.toFixed(2)}`,
    textBody: `
Hi ${data.recipientName},

${bodyIntro}

Reward Amount: $${data.rewardAmount.toFixed(2)}
${data.totalReferrals ? `Total Referrals: ${data.totalReferrals}` : ""}
${data.totalEarnings ? `Total Earnings: $${data.totalEarnings.toFixed(2)}` : ""}

Watch your referral network grow and earn more rewards!

View your referrals: https://stacktrackpro.com/dashboard/referral-leaderboard

Best regards,
StackTrackPro Team
    `,
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Referral Reward</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #28a745; margin-bottom: 16px;">🎉 Referral Reward Unlocked!</h1>
    <p style="font-size: 16px;">Hi ${data.recipientName},</p>
    
    <p>${bodyIntro}</p>
    
    <div style="background-color: #f0f7f0; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #28a745;">
      <p style="margin: 8px 0; font-size: 24px; color: #28a745; font-weight: bold;">+$${data.rewardAmount.toFixed(2)}</p>
      <p style="margin: 8px 0;"><strong>Reward Type:</strong> ${data.rewardType === "commission" ? "Referral Commission" : data.rewardType === "milestone" ? "Milestone Bonus" : "Tier Bonus"}</p>
      ${data.totalReferrals ? `<p style="margin: 8px 0;"><strong>Total Referrals:</strong> ${data.totalReferrals}</p>` : ""}
      ${data.totalEarnings ? `<p style="margin: 8px 0;"><strong>Total Referral Earnings:</strong> $${data.totalEarnings.toFixed(2)}</p>` : ""}
    </div>
    
    <p>Keep referring your friends to unlock even more rewards! The more people you refer, the more you earn.</p>
    
    <a href="https://stacktrackpro.com/dashboard/referral-leaderboard" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin: 20px 0;">
      View Your Referrals
    </a>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">Share your referral link: https://stacktrackpro.com/?ref=YOUR_CODE</p>
  </div>
</body>
</html>
    `,
  };
};
