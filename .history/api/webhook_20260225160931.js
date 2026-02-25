import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';

// Tell Vercel NOT to parse the body so Stripe can read the raw signature
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read the raw data stream
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Grab the raw, untouched body for Stripe to verify
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Webhook signature failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;
    const licenseKey = `ADITYA-PRO-${session.id.slice(-10).toUpperCase()}`;

    try {
      // Put the key in the Supabase Vault
      const { error: dbError } = await supabase
        .from('license_keys')
        .insert([{ key_string: licenseKey, email: customerEmail, is_active: true }]);

      if (dbError) throw dbError;

      // Email the key to the customer
      await resend.emails.send({
        from: 'Aditya Labs <security@adityalabs.ai>',
        to: customerEmail,
        subject: 'Welcome to Shield Pro - Your Enterprise License Key',
        html: `
          <div style="font-family: sans-serif; color: #111;">
            <h2>Secure Data Processing Activated 🛡️</h2>
            <p>Thank you for upgrading to Aditya Privacy Shield Pro.</p>
            <p>Your unique Enterprise License Key is:</p>
            <h3 style="background: #0055ff; color: white; padding: 10px; border-radius: 5px; display: inline-block;">
              ${licenseKey}
            </h3>
            <p>Download your app from GitHub and paste this key into the Gatekeeper screen.</p>
          </div>
        `
      });

      console.log(`✅ Success: Key ${licenseKey} delivered to ${customerEmail}`);
      return res.status(200).json({ received: true });

    } catch (err) {
      console.error('Error processing fulfillment:', err);
      return res.status(500).send('Internal Server Error');
    }
  }

  res.status(200).json({ received: true });
}