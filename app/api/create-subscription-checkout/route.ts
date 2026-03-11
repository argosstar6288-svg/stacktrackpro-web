/**
 * Stripe Checkout Session for Subscriptions
 * POST /api/create-subscription-checkout
 * 
 * Creates a Stripe checkout session for subscription upgrades
 */

import Stripe from 'stripe';
import { NextResponse } from 'next/server';

// Prevent prerendering of this route
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Initialize Stripe lazily to avoid build-time issues
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    const { priceId, tierId, userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
    }

    // Determine mode based on tier
    const mode: 'subscription' | 'payment' = tierId === 'lifetime' ? 'payment' : 'subscription';

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/pricing?canceled=true`,
      metadata: {
        userId,
        tierId,
      },
      // Allow customer to edit email
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout creation failed' },
      { status: 500 }
    );
  }
}
