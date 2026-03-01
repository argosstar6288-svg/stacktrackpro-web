import functions from "firebase-functions";
import admin from "firebase-admin";
import Stripe from "stripe";
import cors from "cors";

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Enable CORS
const corsHandler = cors({ origin: true });

/**
 * Create a Stripe checkout session for payment
 * Called from frontend when user clicks "Upgrade" or "Get Lifetime"
 * Supports both subscription (recurring) and payment (one-time) modes
 */
export const createCheckoutSession = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { priceId, mode = "subscription", referralCode = null } = data;
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    if (!priceId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Price ID is required"
      );
    }

    // Validate mode
    if (!["subscription", "payment"].includes(mode)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Mode must be 'subscription' or 'payment'"
      );
    }

    // CHECK LIFETIME CAP (only for lifetime/payment mode)
    if (mode === "payment") {
      const systemDoc = await db.collection("admin").doc("system").get();
      const lifetimePurchaseCount = systemDoc.data()?.lifetimePurchaseCount || 0;
      const LIFETIME_CAP = 50;

      if (lifetimePurchaseCount >= LIFETIME_CAP) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "Founding Member slots are full. No more lifetime memberships available."
        );
      }
    }

    try {
      // Get or create Stripe customer
      const userDoc = await db.collection("users").doc(userId).get();
      let stripeCustomerId = userDoc.data()?.stripeCustomerId;

      if (!stripeCustomerId) {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            firebaseUID: userId,
          },
        });
        stripeCustomerId = customer.id;

        // Save to Firestore
        await db.collection("users").doc(userId).update({
          stripeCustomerId: stripeCustomerId,
        });
      }

      // Build line items based on mode
      const lineItems = [
        {
          price: priceId,
          quantity: 1,
        },
      ];

      const sessionConfig = {
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: mode,
        customer_email: userEmail,
        metadata: {
          firebaseUID: userId,
          paymentMode: mode,
          referralCode: referralCode || "",
        },
      };

      // Set success/cancel URLs based on mode
      if (mode === "subscription") {
        sessionConfig.success_url = `${process.env.SITE_URL || "https://stacktrackpro.web.app"}/dashboard/billing?success=true`;
        sessionConfig.cancel_url = `${process.env.SITE_URL || "https://stacktrackpro.web.app"}/dashboard/pricing?canceled=true`;
      } else {
        // One-time payment (lifetime)
        sessionConfig.success_url = `${process.env.SITE_URL || "https://stacktrackpro.web.app"}/dashboard/billing?lifetime=success`;
        sessionConfig.cancel_url = `${process.env.SITE_URL || "https://stacktrackpro.web.app"}/dashboard/pricing?lifetime=canceled`;
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create(sessionConfig);

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      console.error("Checkout session error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create checkout session"
      );
    }
  });

/**
 * Handle Stripe webhook events
 * Processes payments, subscriptions, disputes
 */
export const handleStripeWebhook = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const sig = req.headers["stripe-signature"];

      if (!sig) {
        res.status(400).send("Missing stripe-signature header");
        return;
      }

      try {
        // Verify webhook signature
        const event = stripe.webhooks.constructEvent(
          req.rawBody || req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET || ""
        );

        // Route event to appropriate handler
        switch (event.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated":
            await handleSubscriptionEvent(event.data.object);
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionCanceled(event.data.object);
            break;

          case "invoice.payment_succeeded":
            await handlePaymentSucceeded(event.data.object);
            break;

          case "invoice.payment_failed":
            await handlePaymentFailed(event.data.object);
            break;

          case "charge.succeeded":
            await handleChargeSucceeded(event.data.object);
            break;

          case "charge.dispute.created":
            await handleDispute(event);
            break;

          default:
            console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error);
        res.status(400).send(`Webhook error: ${error.message}`);
      }
    });
  });

/**
 * Handle subscription creation/update events
 */
async function handleSubscriptionEvent(subscription) {
  const userId = subscription.metadata?.firebaseUID;
  if (!userId) {
    console.error("No Firebase UID in subscription metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = getPriceToTier(priceId);

  // Determine renewal date
  const renewalDate = new Date(subscription.current_period_end * 1000);

  await db.collection("users").doc(userId).update({
    role: tier,
    "subscription.tier": tier,
    "subscription.stripeSubscriptionId": subscription.id,
    "subscription.status": subscription.status,
    "subscription.renewalDate": renewalDate,
    "subscription.priceId": priceId,
    updatedAt: new Date(),
  });

  console.log(`Updated user ${userId} to tier ${tier}`);

  // Log to admin analytics
  await db.collection("admin").doc("logs").collection("subscriptions").add({
    event: "subscription_updated",
    userId: userId,
    tier: tier,
    status: subscription.status,
    timestamp: new Date(),
  });
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(subscription) {
  const userId = subscription.metadata?.firebaseUID;
  if (!userId) return;

  // Downgrade to free tier
  await db.collection("users").doc(userId).update({
    role: "free",
    "subscription.tier": "free",
    "subscription.status": "canceled",
    "subscription.canceledAt": new Date(subscription.canceled_at * 1000),
    updatedAt: new Date(),
  });

  console.log(`Downgraded user ${userId} to free tier (subscription canceled)`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
  const userId = invoice.metadata?.firebaseUID;
  if (!userId) return;

  // Log payment
  await db
    .collection("users")
    .doc(userId)
    .collection("payments")
    .add({
      type: "payment_succeeded",
      amount: invoice.amount_paid,
      currency: invoice.currency,
      invoiceId: invoice.id,
      timestamp: new Date(),
    });

  console.log(`Payment succeeded for user ${userId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  const userId = invoice.metadata?.firebaseUID;
  if (!userId) return;

  // Update subscription status to past_due
  await db.collection("users").doc(userId).update({
    "subscription.status": "past_due",
    "subscription.lastFailedPayment": new Date(),
  });

  // Log payment failure
  await db
    .collection("users")
    .doc(userId)
    .collection("payments")
    .add({
      type: "payment_failed",
      attempted_amount: invoice.amount_due,
      currency: invoice.currency,
      invoiceId: invoice.id,
      timestamp: new Date(),
    });

  console.log(`Payment failed for user ${userId}`);
}

/**
 * Handle charge succeeded event (one-time payments like lifetime)
 * Only called for one-time charges, not subscription payments
 */
async function handleChargeSucceeded(charge) {
  const chargeMetadata = charge.metadata || {};
  
  // Look for userId in charge metadata or Firestore lookup
  let userId = chargeMetadata.firebaseUID;

  // If no metadata, try to find via customer
  if (!userId && charge.customer) {
    try {
      const customer = await stripe.customers.retrieve(charge.customer);
      userId = customer.metadata?.firebaseUID;
    } catch (err) {
      console.error("Could not retrieve customer for charge:", err);
    }
  }

  if (!userId) {
    console.warn("No Firebase UID found for charge:", charge.id);
    return;
  }

  // Check if this is a lifetime plan charge
  // Look for specific price ID or description
  const isLifetimeCharge = 
    chargeMetadata.productType === "lifetime" ||
    charge.description?.toLowerCase().includes("lifetime") ||
    charge.description?.toLowerCase().includes("founder");

  if (isLifetimeCharge) {
    await handleLifetimePayment(userId, charge);
  } else {
    // Regular one-time charge - log it
    await db
      .collection("users")
      .doc(userId)
      .collection("payments")
      .add({
        type: "charge_succeeded",
        amount: charge.amount,
        currency: charge.currency,
        chargeId: charge.id,
        timestamp: new Date(),
      });

    console.log(`Charge succeeded for user ${userId}`);
  }
}

/**
 * Handle lifetime membership payment
 * Upgrades user to "founder" role permanently
 * Generates referral code, increments cap, handles referral bonuses
 */
async function handleLifetimePayment(userId, charge) {
  try {
    const now = new Date();
    const referralCodeFromMetadata = charge.metadata?.referralCode || null;

    // 1. INCREMENT LIFETIME PURCHASE COUNTER
    const systemDoc = await db.collection("admin").doc("system").get();
    const currentCount = systemDoc.data()?.lifetimePurchaseCount || 0;
    const LIFETIME_CAP = 50;

    if (currentCount >= LIFETIME_CAP) {
      throw new Error("Lifetime cap exceeded - this should have been caught at checkout!");
    }

    await db.collection("admin").doc("system").update({
      lifetimePurchaseCount: currentCount + 1,
      lastLifetimePurchaseAt: now,
    });

    // 2. GENERATE UNIQUE REFERRAL CODE
    const referralCode = generateReferralCodeServer();

    // 3. UPGRADE USER TO FOUNDER ROLE
    await db.collection("users").doc(userId).update({
      role: "founder",
      "subscription.tier": "founder",
      "subscription.status": "active",
      "subscription.isLifetime": true,
      "subscription.lifetimeActivatedAt": now,
      "subscription.lifetimeChargeId": charge.id,
      referralCode: referralCode,
      referralCodeCreatedAt: now,
      // Initialize referral stats
      "referralStats.totalReferrals": 0,
      "referralStats.completedReferrals": 0,
      "referralStats.totalBonusEarned": 0,
      "account.storeCredit": 0,
      updatedAt: now,
    });

    // 4. HANDLE REFERRAL BONUS (if user used referral code)
    if (referralCodeFromMetadata) {
      await processReferralBonus(userId, referralCodeFromMetadata, now);
    }

    // 5. LOG TO ADMIN - FOUNDER REGISTRATION
    await db.collection("admin").doc("logs").collection("founderRegistrations").add({
      event: "lifetime_purchased",
      userId: userId,
      amount: charge.amount,
      currency: charge.currency,
      chargeId: charge.id,
      referralCode: referralCode,
      referredBy: referralCodeFromMetadata || null,
      slotNumber: currentCount + 1, // Track which slot this is (e.g., 20/50)
      timestamp: now,
    });

    // 6. LOG TO USER PAYMENTS
    await db
      .collection("users")
      .doc(userId)
      .collection("payments")
      .add({
        type: "lifetime_purchased",
        amount: charge.amount,
        currency: charge.currency,
        chargeId: charge.id,
        referralCode: referralCode,
        timestamp: now,
      });

    console.log(`Lifetime membership activated for user ${userId} (Slot ${currentCount + 1}/50)`);
  } catch (error) {
    console.error("Error handling lifetime payment:", error);
    // Re-throw so webhook is retried
    throw error;
  }
}

/**
 * Process referral bonus when user joins with referral code
 * Uses tiered bonus system based on referrer's completed referral count
 */
async function processReferralBonus(newUserId, referralCode, now) {
  try {
    // Find the referrer by code
    const referrersSnapshot = await db
      .collection("users")
      .where("referralCode", "==", referralCode.toUpperCase())
      .limit(1)
      .get();

    if (referrersSnapshot.empty) {
      console.warn(`Referral code ${referralCode} not found`);
      return;
    }

    const referrerDoc = referrersSnapshot.docs[0];
    const referrerId = referrerDoc.id;
    const referrerData = referrerDoc.data();

    // Get referrer's current tier bonus (based on completed referrals)
    // Tier structure:
    // 1+ referrals: $50 per referral
    // 3+ referrals: $75 per referral
    // 5+ referrals: $100 per referral
    // 10+ referrals: $150 per referral
    const completedReferrals = referrerData?.referralStats?.completedReferrals || 0;
    let bonusAmount = 5000; // $50 base

    if (completedReferrals >= 10) {
      bonusAmount = 15000; // $150
    } else if (completedReferrals >= 5) {
      bonusAmount = 10000; // $100
    } else if (completedReferrals >= 3) {
      bonusAmount = 7500; // $75
    }

    // Record the referral
    await db
      .collection("users")
      .doc(referrerId)
      .collection("referrals")
      .add({
        referredUserId: newUserId,
        referralCode: referralCode.toUpperCase(),
        status: "completed",
        bonusAwarded: true,
        bonusAmount: bonusAmount, // Store the tier-based bonus
        createdAt: now,
        completedAt: now,
      });

    // Award tiered bonus
    const currentBonus = referrerData?.referralStats?.totalBonusEarned || 0;
    const currentCredit = referrerData?.account?.storeCredit || 0;
    const newCompletedReferrals = completedReferrals + 1;

    await db.collection("users").doc(referrerId).update({
      "referralStats.completedReferrals": newCompletedReferrals,
      "referralStats.totalBonusEarned": currentBonus + bonusAmount,
      "referralStats.lastBonusAt": now,
      "referralStats.currentTier": getTierName(newCompletedReferrals),
      "account.storeCredit": currentCredit + bonusAmount,
    });

    // Log bonus award with tier info
    await db.collection("admin").doc("logs").collection("referralBonuses").add({
      event: "bonus_awarded",
      referrerId: referrerId,
      referredUserId: newUserId,
      bonusAmount: bonusAmount,
      tier: getTierName(newCompletedReferrals),
      totalReferralsNow: newCompletedReferrals,
      timestamp: now,
    });

    console.log(
      `Tiered referral bonus awarded to ${referrerId}: $${(bonusAmount / 100).toFixed(2)} (Tier: ${getTierName(newCompletedReferrals)})`
    );
  } catch (error) {
    console.error("Error processing referral bonus:", error);
    // Don't re-throw - bonus is a nice-to-have, not critical
  }
}

/**
 * Get tier name based on completed referrals
 */
function getTierName(completedReferrals) {
  if (completedReferrals >= 10) return "Ambassador";
  if (completedReferrals >= 5) return "Influencer";
  if (completedReferrals >= 3) return "Rising";
  return "Emerging";
}

/**
 * Generate unique referral code (8 alphanumeric)
 */
function generateReferralCodeServer() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Handle payment disputes (fraud)
 */
async function handleDispute(event) {
  const dispute = event.data.object;
  const charge = await stripe.charges.retrieve(dispute.charge);
  const userId = charge.metadata?.firebaseUID;

  if (!userId) return;

  // Log dispute
  await db.collection("admin").doc("logs").collection("disputes").add({
    event: "charge_dispute",
    userId: userId,
    amount: dispute.amount,
    reason: dispute.reason,
    status: dispute.status,
    timestamp: new Date(),
  });

  console.log(`Dispute created for user ${userId}`);
}

/**
 * Cancel a subscription
 * Scheduled to end at period end (graceful cancellation)
 * NOTE: Lifetime members cannot cancel their membership
 */
export const cancelSubscription = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = context.auth.uid;

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      // Protect lifetime members
      if (userData?.role === "founder" || userData?.subscription?.isLifetime) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Lifetime members cannot cancel their membership. Your founding membership is permanent."
        );
      }

      const stripeSubscriptionId = userData?.subscription?.stripeSubscriptionId;

      if (!stripeSubscriptionId) {
        throw new functions.https.HttpsError(
          "not-found",
          "No active subscription found"
        );
      }

      // Cancel at period end (graceful)
      const subscription = await stripe.subscriptions.update(
        stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      // Update Firestore
      await db.collection("users").doc(userId).update({
        "subscription.cancelAtPeriodEnd": true,
        "subscription.canceledAt": new Date(subscription.canceled_at * 1000),
      });

      return {
        message: "Subscription scheduled for cancellation at period end",
        renewalDate: new Date(subscription.current_period_end * 1000),
      };
    } catch (error) {
      console.error("Cancel subscription error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to cancel subscription"
      );
    }
  });

/**
 * Reactivate a canceled subscription
 */
export const reactivateSubscription = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = context.auth.uid;

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const stripeSubscriptionId = userDoc.data()?.subscription?.stripeSubscriptionId;

      if (!stripeSubscriptionId) {
        throw new functions.https.HttpsError(
          "not-found",
          "No subscription found"
        );
      }

      // Reactivate subscription
      const subscription = await stripe.subscriptions.update(
        stripeSubscriptionId,
        {
          cancel_at_period_end: false,
        }
      );

      // Update Firestore
      await db.collection("users").doc(userId).update({
        "subscription.cancelAtPeriodEnd": false,
        "subscription.status": "active",
      });

      return {
        success: true,
        message: "Subscription reactivated",
        renewalDate: new Date(subscription.current_period_end * 1000),
      };
    } catch (error) {
      console.error("Reactivate subscription error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to reactivate subscription"
      );
    }
  });

/**
 * Get a Stripe Billing Portal session
 * Allows users to manage payment methods, view invoices, etc.
 */
export const getPortalSession = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = context.auth.uid;

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const stripeCustomerId = userDoc.data()?.stripeCustomerId;

      if (!stripeCustomerId) {
        throw new functions.https.HttpsError(
          "not-found",
          "No Stripe customer found"
        );
      }

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${process.env.SITE_URL || "https://stacktrackpro.web.app"}/dashboard/billing`,
      });

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      console.error("Portal session error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create portal session"
      );
    }
  });

/**
 * Helper: Map Stripe price ID to tier name
 */
function getPriceToTier(priceId) {
  const tierMap = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY || ""]: "pro",
    [process.env.STRIPE_PRICE_PRO_YEARLY || ""]: "pro",
    [process.env.STRIPE_PRICE_PREMIUM_MONTHLY || ""]: "premium",
    [process.env.STRIPE_PRICE_PREMIUM_YEARLY || ""]: "premium",
  };

  return tierMap[priceId] || "free";
}

/**
 * ADMIN FUNCTIONS (requires admin privileges)
 */

/**
 * Manually set a user's subscription tier
 * Call pattern: setUserSubscription({userId, tier, daysValid})
 */
export const setUserSubscription = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    // Verify admin
    if (!context.auth?.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required"
      );
    }

    const { userId, tier, daysValid = 30 } = data;

    if (!userId || !tier) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userId and tier are required"
      );
    }

    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + daysValid);

    await db.collection("users").doc(userId).update({
      role: tier,
      "subscription.tier": tier,
      "subscription.status": "active",
      "subscription.renewalDate": renewalDate,
      "subscription.manual": true,
      updatedAt: new Date(),
    });

    // Log admin action
    await db.collection("admin").doc("logs").collection("adminActions").add({
      action: "setUserSubscription",
      adminUid: context.auth.uid,
      targetUserId: userId,
      tier: tier,
      timestamp: new Date(),
    });

    return { success: true };
  });

/**
 * Send welcome email to new subscriber
 * Can be called from webhook handler or manually
 */
export const sendWelcomeEmail = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const { userId, tier } = data;

    // In production, integrate with SendGrid, Mailgun, or similar
    // For now, just log it
    console.log(
      `[EMAIL] Welcome email sent to user ${userId} for tier ${tier}`
    );

    // Log email send attempt
    await db
      .collection("users")
      .doc(userId)
      .collection("emails")
      .add({
        type: "welcome",
        tier: tier,
        status: "sent",
        timestamp: new Date(),
      });

    return { success: true };
  });
