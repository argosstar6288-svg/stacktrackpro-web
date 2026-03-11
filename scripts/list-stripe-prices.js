const Stripe = require('stripe');

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('❌ Missing STRIPE_SECRET_KEY in environment variables.');
  console.error('Set it first, then run this script again.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

async function listPrices() {
  try {
    const prices = await stripe.prices.list({
      limit: 100,
      expand: ['data.product'],
    });

    console.log('\n========== STRIPE PRICES ==========\n');
    
    if (prices.data.length === 0) {
      console.log('❌ No prices found. You need to create subscription products first.\n');
      console.log('Create them here: https://dashboard.stripe.com/products\n');
      return;
    }

    prices.data.forEach((price) => {
      const product = price.product;
      const productName = typeof product === 'object' ? product.name : 'Unknown';
      const amount = price.unit_amount ? (price.unit_amount / 100) : 'variable';
      const interval = price.recurring?.interval || 'one-time';
      const currency = price.currency.toUpperCase();

      console.log(`Product: ${productName}`);
      console.log(`Price ID: ${price.id}`);
      console.log(`Amount: $${amount} ${currency}`);
      console.log(`Interval: ${interval}`);
      console.log(`Status: ${price.active ? '✓ Active' : '✗ Inactive'}`);
      console.log('---\n');
    });

    console.log('========== COPY THESE IDS TO .env.local ==========\n');

    // Try to categorize
    prices.data.forEach((price) => {
      const product = price.product;
      const productName = typeof product === 'object' ? product.name : '';
      const name = productName.toLowerCase();
      const interval = price.recurring?.interval || 'once';
      
      if (name.includes('pro') && interval === 'month') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=${price.id}`);
      } else if (name.includes('pro') && interval === 'year') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=${price.id}`);
      } else if (name.includes('premium') && interval === 'month') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_MONTHLY=${price.id}`);
      } else if (name.includes('premium') && interval === 'year') {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_YEARLY=${price.id}`);
      } else if (name.includes('lifetime')) {
        console.log(`NEXT_PUBLIC_STRIPE_PRICE_LIFETIME=${price.id}`);
      } else {
        // Fallback: just list with interval
        console.log(`# ${productName || 'Unknown'} (${interval}): ${price.id}`);
      }
    });

  } catch (error) {
    console.error('Error fetching prices:', error.message);
  }
}

listPrices();
