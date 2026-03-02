/**
 * Stripe Webhook Handler for Credit Purchases
 * POST /api/webhooks/stripe-credits
 * 
 * CRITICAL: This is the ONLY place credits are added to user accounts.
 * Never trust frontend success pages - always verify via webhook.
 */

import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { addCredits } from '@/lib/credits';

// Prevent prerendering of this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Initialize Stripe lazily to avoid build-time issues
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log('Credit purchase completed:', {
          sessionId: session.id,
          userId: session.metadata?.userId,
          credits: session.metadata?.credits,
        });

        // Extract metadata
        const userId = session.metadata?.userId;
        const packId = session.metadata?.packId;
        const credits = parseInt(session.metadata?.credits || '0', 10);

        if (!userId || !credits) {
          console.error('Missing required metadata in checkout session:', session.metadata);
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
        }

        // Add credits to user account
        const result = await addCredits(userId, credits, 'stripe_purchase', {
          packId,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          amountTotal: session.amount_total,
          currency: session.currency,
          customerEmail: session.customer_email,
        });

        if (!result.success) {
          console.error('Failed to add credits:', result.error);
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        console.log(`Successfully added ${credits} credits to user ${userId}. New balance: ${result.newBalance}`);

        // TODO: Send confirmation email to user
        // await sendCreditPurchaseEmail(userId, credits, result.newBalance);

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session expired:', session.id);
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        console.log('Charge succeeded:', charge.id);
        // Already handled in checkout.session.completed
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log('Charge refunded:', charge.id);
        
        // TODO: Subtract credits if refund issued
        // This would require looking up the original transaction and reversing it
        // For now, log the refund for manual review
        console.warn('REFUND ISSUED - Manual credit reversal may be required:', {
          chargeId: charge.id,
          amount: charge.amount_refunded,
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
