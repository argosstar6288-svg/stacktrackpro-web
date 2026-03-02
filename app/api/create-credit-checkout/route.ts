/**
 * Stripe Checkout Session for Credit Purchases
 * POST /api/create-credit-checkout
 * 
 * Creates a Stripe checkout session for buying credit packs
 */

import Stripe from 'stripe';
import { NextResponse } from 'next/server';

// Prevent prerendering of this route
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Initialize Stripe lazily to avoid build-time issues
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    const { packId, userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Map packId to price and credits
    const packMap: Record<string, { priceId: string; credits: number; price: number }> = {
      pack_10: {
        priceId: process.env.STRIPE_PRICE_10_CREDITS!,
        credits: 10,
        price: 5.0,
      },
      pack_50: {
        priceId: process.env.STRIPE_PRICE_50_CREDITS!,
        credits: 50,
        price: 20.0,
      },
      pack_200: {
        priceId: process.env.STRIPE_PRICE_200_CREDITS!,
        credits: 200,
        price: 60.0,
      },
    };

    const pack = packMap[packId];

    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `${pack.credits} StackTrack Credits`,
              description: `${pack.credits} credits for premium features`,
              images: ['https://stacktrackpro.com/logo.png'], // Optional
            },
            unit_amount: Math.round(pack.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/credits?canceled=true`,
      metadata: {
        userId,
        packId,
        credits: pack.credits.toString(),
      },
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
