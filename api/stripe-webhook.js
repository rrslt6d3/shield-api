import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// ── MAP your Stripe Price IDs to tier levels ──────────────
// Go to Stripe Dashboard → Products → copy price_XXXX ids
const PRICE_TO_TIER = {
  "price_1T53tEC3tIcB9GFKoMpw0hPf":         1,   // Solo £99/mo
  "price_1T53u4C3tIcB9GFKvqKIFHAp": 2,   // Professional £249/mo
  "price_1T53uwC3tIcB9GFK1x8YfsTg":     3,   // Business £499/mo
};

const TIER_NAMES = { 1: "Solo", 2: "Professional", 3: "Business" };
const TIER_PRICES = { 1: "£99", 2: "£249", 3: "£499" };

function generateLicenseKey() {
  const seg = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `SP-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Only process successful payments
  if (event.type !== "checkout.session.completed" &&
      event.type !== "customer.subscription.created") {
    return res.status(200).json({ received: true });
  }

  try {
    let customerEmail = "";
    let customerName  = "Valued Customer";
    let priceId       = "";
    let stripeCustomerId = "";

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      customerEmail    = session.customer_details?.email || "";
      customerName     = session.customer_details?.name  || "Valued Customer";
      stripeCustomerId = session.customer || "";

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      priceId = lineItems.data[0]?.price?.id || "";

    } else if (event.type === "customer.subscription.created") {
      const sub = event.data.object;
      stripeCustomerId = sub.customer;
      priceId = sub.items.data[0]?.price?.id || "";

      const customer = await stripe.customers.retrieve(stripeCustomerId);
      customerEmail = customer.email || "";
      customerName  = customer.name  || "Valued Customer";
    }

    if (!customerEmail) {
      console.error("No customer email in event");
      return res.status(400).json({ error: "No email" });
    }

    const tierLevel  = PRICE_TO_TIER[priceId] ?? 1;
    const tierName   = TIER_NAMES[tierLevel];
    const tierPrice  = TIER_PRICES[tierLevel];
    const licenseKey = generateLicenseKey();

    // ── Save to Supabase ──────────────────────────────────
    const { error: dbError } = await supabase
      .from("license_keys")
      .insert({
        key_string:      licenseKey,
        is_active:       true,
        tier_level:      tierLevel,
        customer_email:  customerEmail,
        customer_name:   customerName,
        stripe_customer: stripeCustomerId,
        stripe_price_id: priceId,
        created_at:      new Date().toISOString(),
      });

    if (dbError) {
      console.error("Supabase error:", dbError);
      return res.status(500).json({ error: "Database error" });
    }

    // ── Send license email ────────────────────────────────
    await resend.emails.send({
      from:    "Shield Pro <licenses@adityalabs.ai>",
      to:      customerEmail,
      subject: `Your Shield Pro ${tierName} License Key`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#0a0a0f;color:#e6edf3;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:#13131f;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden}
.hdr{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a855f7 100%);padding:2rem;text-align:center}
.hdr h1{color:#fff;font-size:1.5rem;font-weight:800;margin:0}
.hdr p{color:rgba(255,255,255,.8);margin:.5rem 0 0;font-size:.9rem}
.body{padding:2rem}
.key-box{background:#0a0a0f;border:1px solid #4f46e5;border-radius:10px;padding:1.25rem;text-align:center;margin:1.5rem 0}
.key{font-family:"Courier New",monospace;font-size:1.3rem;font-weight:700;color:#a78bfa;letter-spacing:2px}
.lbl{font-size:.7rem;color:#6b6b8a;text-transform:uppercase;letter-spacing:2px;margin-bottom:.5rem}
.steps{background:#0d0d18;border-radius:10px;padding:1.25rem;margin:1.5rem 0}
.steps h3{color:#fff;font-size:.9rem;margin:0 0 1rem}
.step{display:flex;gap:.75rem;margin-bottom:.75rem;align-items:flex-start}
.num{background:#4f46e5;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;line-height:22px;text-align:center}
.step-t{font-size:.85rem;color:#c4c4d4;line-height:1.5}
.btn{display:block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;text-align:center;padding:.9rem;border-radius:10px;font-weight:700;font-size:.9rem;margin:1.5rem 0;letter-spacing:1px}
.foot{text-align:center;padding:1.5rem;border-top:1px solid #1e1e2e;font-size:.78rem;color:#6b6b8a}
.foot a{color:#818cf8;text-decoration:none}
</style></head>
<body>
<div class="wrap">
  <div class="hdr"><h1>🛡️ Shield Pro</h1><p>Your ${tierName} license is ready</p></div>
  <div class="body">
    <p style="color:#c4c4d4;margin:0 0 1rem">Hi ${customerName},</p>
    <p style="color:#c4c4d4;margin:0 0 1.5rem;line-height:1.6">Thank you for purchasing Shield Pro ${tierName} (${tierPrice}/mo). Your license key is below:</p>
    <div class="key-box">
      <div class="lbl">Your License Key</div>
      <div class="key">${licenseKey}</div>
    </div>
    <div class="steps">
      <h3>How to activate:</h3>
      <div class="step"><div class="num">1</div><div class="step-t">Download and install Shield Pro using the button below</div></div>
      <div class="step"><div class="num">2</div><div class="step-t">Launch the app — the license screen appears automatically</div></div>
      <div class="step"><div class="num">3</div><div class="step-t">Paste your key above and click <strong>Authenticate License</strong></div></div>
      <div class="step"><div class="num">4</div><div class="step-t">You're live — the app works fully offline from this point</div></div>
    </div>
    <a href="https://adityalabs.ai/shield-pro/download" class="btn">⬇ Download Shield Pro for Windows</a>
    <p style="color:#6b6b8a;font-size:.8rem;line-height:1.6">Keep this email safe. If you lose your key contact <a href="mailto:support@adityalabs.ai" style="color:#818cf8">support@adityalabs.ai</a></p>
  </div>
  <div class="foot">
    Shield Pro by <a href="https://adityalabs.ai">Aditya Labs</a> &nbsp;|&nbsp;
    <a href="https://adityalabs.ai/terms">Terms</a> &nbsp;|&nbsp;
    <a href="mailto:support@adityalabs.ai">Support</a>
    <p style="margin:.5rem 0 0;color:#3d3d5c">© 2026 Aditya Labs. All rights reserved.</p>
  </div>
</div>
</body></html>`,
    });

    console.log(`✓ License issued: ${licenseKey} | Tier ${tierLevel} | ${customerEmail}`);
    return res.status(200).json({ success: true, tier: tierLevel });

  } catch (err) {
    console.error("Processing error:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
}

// Required to parse raw body for Stripe signature verification
export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}
