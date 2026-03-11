const Stripe = require('stripe');

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('❌ Missing STRIPE_SECRET_KEY in environment variables.');
  console.error('Set it first, then run this script again.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

async function createYearlyPrices() {
  try {
    console.log('\n📝 Creating yearly subscription prices...\n');

    // Pro Yearly: $150 CAD (roughly $15 * 12 * 0.83 for discount)
    console.log('🚀 Creating Pro Yearly ($150 CAD)...');
    const proYearly = await stripe.prices.create({
      product: 'prod_U36YISAMgfVKUi', // Pro product ID
      unit_amount: 15000, // $150 in cents
      currency: 'cad',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
    });
    console.log(`✓ Pro Yearly created: ${proYearly.id}\n`);

    // Premium Yearly: $200 CAD (roughly $20 * 12 * 0.83 for discount)
    console.log('🚀 Creating Premium Yearly ($200 CAD)...');
    const premiumYearly = await stripe.prices.create({
      product: 'prod_U31vsFLiOouGdE', // Premium product ID
      unit_amount: 20000, // $200 in cents
      currency: 'cad',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
    });
    console.log(`✓ Premium Yearly created: ${premiumYearly.id}\n`);

    console.log('========== ✅ ADD THESE TO .env.local ==========\n');
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=${proYearly.id}`);
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY=${premiumYearly.id}`);

  } catch (error) {
    console.error('❌ Error creating yearly prices:', error.message);
  }
}

createYearlyPrices();
