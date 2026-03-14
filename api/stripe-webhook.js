import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// ── 5-Tier Pricing: Map Stripe Price IDs → Tier Levels ──────────────────────
// Set these as Vercel environment variables:
// STRIPE_PRICE_STARTER, STRIPE_PRICE_SOLO, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_ENTERPRISE
const PRICE_TO_TIER = {
  [process.env.STRIPE_PRICE_STARTER]:      0, // Starter £29/mo
  [process.env.STRIPE_PRICE_SOLO]:         1, // Solo £99/mo
  [process.env.STRIPE_PRICE_PROFESSIONAL]: 2, // Professional £249/mo
  [process.env.STRIPE_PRICE_BUSINESS]:     3, // Business £499/mo
  [process.env.STRIPE_PRICE_ENTERPRISE]:   4, // Enterprise £999/mo
};

const TIER_NAMES  = { 0: "Starter", 1: "Solo", 2: "Professional", 3: "Business", 4: "Enterprise" };
const TIER_PRICES = { 0: "£29", 1: "£99", 2: "£249", 3: "£499", 4: "£999" };
const TIER_DEVICES = { 0: 1, 1: 1, 2: 3, 3: 10, 4: 25 };

const TIER_FEATURES = {
  0: ["File & Content Search", "6 PII Filters", "Text Redaction", "Dashboard & Analytics", "Duplicate Detection", "Bookmarks"],
  1: ["All 15 PII Filters", "Custom Patterns & Profiles", "Watch Folder", "Compliance Center (7 Frameworks)", "PDF Audit Certificates", "AI Analysis", "Regex Playground"],
  2: ["Batch Processing", "Document Compare", "Scan Statistics", "Scheduled Scans", "3 Devices"],
  3: ["Image Redaction", "REST API Server", "Custom Compliance Frameworks", "Audit Trail Export", "10 Seats / Devices"],
  4: ["Audio Transcription & PII", "RBAC & Team Management (25 Seats)", "White-Label Audit Certificates", "Webhook Notifications", "Encrypted Audit Exports", "Compliance Trend Dashboard", "Executive Summary Reports", "Multi-Folder Scanning"],
};

// ── License Key Generator: AL-XXXX-XXXX-XXXX-XXXX ──────────────────────────
function generateLicenseKey() {
  const seg = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `AL-${seg()}-${seg()}-${seg()}-${seg()}`;
}

// ── Email helpers ────────────────────────────────────────────────────────────

async function sendLicenseEmail(customerEmail, customerName, licenseKey, tierLevel) {
  const tierName = TIER_NAMES[tierLevel];
  const tierPrice = TIER_PRICES[tierLevel];
  const features = TIER_FEATURES[tierLevel] || [];
  const maxDevices = TIER_DEVICES[tierLevel];

  const featureListHtml = features.map(f => `<li style="color:#c4c4d4;margin-bottom:6px;font-size:.85rem">${f}</li>`).join("");

  await resend.emails.send({
    from: "Aditya Lens <licenses@adityalabs.ai>",
    to: customerEmail,
    subject: `Your Aditya Lens ${tierName} License Key`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#08081a;color:#e6edf3;margin:0;padding:0}
.wrap{max-width:580px;margin:40px auto;background:#0f0f23;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden}
.hdr{background:linear-gradient(135deg,#1a1a2e 0%,#2d1f4e 50%,#1a1a2e 100%);padding:2.5rem;text-align:center;border-bottom:2px solid #c4a265}
.hdr h1{color:#c4a265;font-size:1.6rem;font-weight:800;margin:0;letter-spacing:1px}
.hdr p{color:rgba(196,162,101,.8);margin:.5rem 0 0;font-size:.9rem}
.body{padding:2rem}
.key-box{background:#08081a;border:2px solid #c4a265;border-radius:12px;padding:1.5rem;text-align:center;margin:1.5rem 0}
.key{font-family:"Courier New",monospace;font-size:1.4rem;font-weight:700;color:#c4a265;letter-spacing:3px}
.lbl{font-size:.7rem;color:#6b6b8a;text-transform:uppercase;letter-spacing:2px;margin-bottom:.5rem}
.tier-badge{display:inline-block;background:linear-gradient(135deg,#c4a265,#d4b878);color:#08081a;padding:6px 16px;border-radius:20px;font-weight:700;font-size:.8rem;letter-spacing:1px;margin:.75rem 0}
.features{background:#0a0a1a;border:1px solid #1e1e2e;border-radius:10px;padding:1.25rem;margin:1.5rem 0}
.features h3{color:#c4a265;font-size:.85rem;margin:0 0 .75rem;text-transform:uppercase;letter-spacing:1px}
.features ul{margin:0;padding:0 0 0 1.2rem}
.steps{background:#0a0a1a;border-radius:10px;padding:1.25rem;margin:1.5rem 0}
.steps h3{color:#fff;font-size:.9rem;margin:0 0 1rem}
.step{display:flex;gap:.75rem;margin-bottom:.75rem;align-items:flex-start}
.num{background:#c4a265;color:#08081a;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;line-height:22px;text-align:center}
.step-t{font-size:.85rem;color:#c4c4d4;line-height:1.5}
.btn{display:block;background:linear-gradient(135deg,#c4a265,#d4b878);color:#08081a;text-decoration:none;text-align:center;padding:1rem;border-radius:10px;font-weight:700;font-size:.95rem;margin:1.5rem 0;letter-spacing:1px}
.meta{display:flex;justify-content:space-between;margin:1rem 0;padding:1rem;background:#0a0a1a;border-radius:8px;font-size:.8rem;color:#6b6b8a}
.foot{text-align:center;padding:1.5rem;border-top:1px solid #1e1e2e;font-size:.78rem;color:#6b6b8a}
.foot a{color:#c4a265;text-decoration:none}
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>ADITYA LENS</h1>
    <p>Enterprise Data Intelligence Suite</p>
  </div>
  <div class="body">
    <p style="color:#c4c4d4;margin:0 0 1rem">Hi ${customerName},</p>
    <p style="color:#c4c4d4;margin:0 0 .5rem;line-height:1.6">Thank you for choosing Aditya Lens. Your license is ready:</p>
    <div style="text-align:center"><span class="tier-badge">${tierName} — ${tierPrice}/mo</span></div>
    <div class="key-box">
      <div class="lbl">Your License Key</div>
      <div class="key">${licenseKey}</div>
    </div>
    <div class="meta">
      <span>Tier: ${tierName}</span>
      <span>Devices: ${maxDevices}</span>
      <span>Billing: Monthly</span>
    </div>
    <div class="features">
      <h3>Your ${tierName} Features</h3>
      <ul>${featureListHtml}</ul>
    </div>
    <div class="steps">
      <h3>How to activate:</h3>
      <div class="step"><div class="num">1</div><div class="step-t">Download Aditya Lens using the button below</div></div>
      <div class="step"><div class="num">2</div><div class="step-t">Launch the app and accept the EULA</div></div>
      <div class="step"><div class="num">3</div><div class="step-t">Go to <strong>Settings → License</strong> and paste your key</div></div>
      <div class="step"><div class="num">4</div><div class="step-t">Click <strong>Activate License</strong> — features unlock instantly</div></div>
    </div>
    <a href="https://github.com/rrslt6d3/aditya-lens/releases/latest" class="btn">Download Aditya Lens for Windows</a>
    <p style="color:#6b6b8a;font-size:.8rem;line-height:1.6">Keep this email safe. Need help? Contact <a href="mailto:support@adityalabs.ai" style="color:#c4a265">support@adityalabs.ai</a></p>
  </div>
  <div class="foot">
    Aditya Lens by <a href="https://adityalabs.ai">Aditya Labs</a> &nbsp;|&nbsp;
    <a href="https://adityalabs.ai/terms">Terms</a> &nbsp;|&nbsp;
    <a href="mailto:support@adityalabs.ai">Support</a>
    <p style="margin:.5rem 0 0;color:#3d3d5c">&copy; 2026 Aditya Labs. All rights reserved.</p>
  </div>
</div>
</body></html>`,
  });
}

async function sendCancellationEmail(email, name, tierName) {
  await resend.emails.send({
    from: "Aditya Lens <licenses@adityalabs.ai>",
    to: email,
    subject: "Your Aditya Lens subscription has been cancelled",
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Inter,sans-serif;background:#08081a;color:#e6edf3;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:#0f0f23;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden}
.hdr{background:#1a1a2e;padding:2rem;text-align:center;border-bottom:2px solid #c4a265}
.hdr h1{color:#c4a265;margin:0;font-size:1.4rem}
.body{padding:2rem}
.btn{display:block;background:linear-gradient(135deg,#c4a265,#d4b878);color:#08081a;text-decoration:none;text-align:center;padding:.9rem;border-radius:10px;font-weight:700;font-size:.9rem;margin:1.5rem 0}
.foot{text-align:center;padding:1.5rem;border-top:1px solid #1e1e2e;font-size:.75rem;color:#6b6b8a}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>ADITYA LENS</h1></div>
  <div class="body">
    <h2 style="color:#fff;margin:0 0 1rem">We're sorry to see you go, ${name || "there"}</h2>
    <p style="color:#c4c4d4;line-height:1.6">Your Aditya Lens <strong>${tierName}</strong> subscription has been cancelled and your license key has been deactivated.</p>
    <p style="color:#c4c4d4;line-height:1.6">All processing was 100% local — we never had access to your files or data.</p>
    <p style="color:#c4c4d4;line-height:1.6">If this was a mistake, you can resubscribe anytime:</p>
    <a href="https://adityalabs.ai/lens" class="btn">Resubscribe to Aditya Lens</a>
  </div>
  <div class="foot">&copy; 2026 Aditya Labs. All rights reserved.</div>
</div></body></html>`,
  });
}

async function sendPaymentFailureEmail(email, name, attemptCount) {
  await resend.emails.send({
    from: "Aditya Lens <licenses@adityalabs.ai>",
    to: email,
    subject: "Payment failed — update your card to keep Aditya Lens active",
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Inter,sans-serif;background:#08081a;color:#e6edf3;margin:0;padding:0}
.wrap{max-width:560px;margin:40px auto;background:#0f0f23;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden}
.hdr{background:#1a1a2e;padding:2rem;text-align:center;border-bottom:2px solid #e74c3c}
.hdr h1{color:#e74c3c;margin:0;font-size:1.4rem}
.body{padding:2rem}
.btn{display:block;background:#e74c3c;color:#fff;text-decoration:none;text-align:center;padding:.9rem;border-radius:10px;font-weight:700;margin:1.5rem 0}
.foot{text-align:center;padding:1.5rem;border-top:1px solid #1e1e2e;font-size:.75rem;color:#6b6b8a}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>PAYMENT FAILED</h1></div>
  <div class="body">
    <p style="color:#c4c4d4;line-height:1.6">Hi ${name || "there"}, we couldn't process your Aditya Lens payment (attempt <strong>${attemptCount} of 3</strong>).</p>
    <p style="color:#e74c3c;font-weight:700">Your license will be deactivated after 3 failed attempts.</p>
    <a href="https://adityalabs.ai/billing" class="btn">Update Payment Method</a>
  </div>
  <div class="foot">&copy; 2026 Aditya Labs. All rights reserved.</div>
</div></body></html>`,
  });
}

async function sendGettingStartedEmail(customerEmail, customerName, tierName) {
  await resend.emails.send({
    from: "Aditya Lens <hello@adityalabs.ai>",
    to: customerEmail,
    subject: "Getting Started with Aditya Lens — Your Quick Start Guide",
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Inter,Arial,sans-serif;background:#08081a;color:#e6edf3;margin:0;padding:0}
.wrap{max-width:600px;margin:40px auto;background:#0f0f23;border:1px solid #1e1e2e;border-radius:16px;overflow:hidden}
.hdr{background:linear-gradient(135deg,#1a1a2e,#2d1f4e,#1a1a2e);padding:2rem;text-align:center;border-bottom:2px solid #c4a265}
.hdr h1{color:#c4a265;font-size:1.4rem;margin:0}
.hdr p{color:rgba(196,162,101,.7);margin:.3rem 0 0;font-size:.85rem}
.body{padding:2rem}
.step-card{background:#0a0a1a;border:1px solid #1e1e2e;border-radius:12px;padding:1.25rem;margin:1rem 0}
.step-num{display:inline-block;background:#c4a265;color:#08081a;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:.85rem;margin-right:10px}
.step-title{color:#fff;font-weight:600;font-size:1rem}
.step-desc{color:#a0a0b8;font-size:.88rem;margin:.5rem 0 0;line-height:1.6}
.warn-box{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:1rem;margin:1.5rem 0}
.warn-title{color:#EF4444;font-weight:700;font-size:.9rem;margin:0 0 .5rem}
.warn-text{color:#c4c4d4;font-size:.85rem;line-height:1.6;margin:0}
.tip-box{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;padding:1rem;margin:1rem 0}
.tip-title{color:#22C55E;font-weight:700;font-size:.9rem;margin:0 0 .5rem}
.tip-text{color:#c4c4d4;font-size:.85rem;line-height:1.6;margin:0}
.btn{display:block;background:linear-gradient(135deg,#c4a265,#d4b878);color:#08081a;text-decoration:none;text-align:center;padding:.9rem;border-radius:10px;font-weight:700;font-size:.9rem;margin:1.5rem 0}
.btn-outline{display:block;border:1px solid #c4a265;color:#c4a265;text-decoration:none;text-align:center;padding:.8rem;border-radius:10px;font-weight:600;font-size:.85rem;margin:.75rem 0}
.foot{text-align:center;padding:1.5rem;border-top:1px solid #1e1e2e;font-size:.75rem;color:#6b6b8a}
.foot a{color:#c4a265;text-decoration:none}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <h1>ADITYA LENS</h1>
    <p>Quick Start Guide</p>
  </div>
  <div class="body">
    <p style="color:#c4c4d4;margin:0 0 .5rem;line-height:1.6">Hi ${customerName},</p>
    <p style="color:#c4c4d4;margin:0 0 1.5rem;line-height:1.6">Welcome to Aditya Lens ${tierName}! Here's everything you need to get up and running in under 5 minutes.</p>

    <div class="step-card">
      <span class="step-num">1</span><span class="step-title">Install the App</span>
      <p class="step-desc">Download the .exe installer from GitHub. Run it — Windows may show a SmartScreen warning (see below). Choose your install location and click Install.</p>
    </div>

    <div class="step-card">
      <span class="step-num">2</span><span class="step-title">Accept the EULA</span>
      <p class="step-desc">On first launch, read and accept the End User License Agreement. Check the agreement box and click "Accept & Continue".</p>
    </div>

    <div class="step-card">
      <span class="step-num">3</span><span class="step-title">Activate Your License</span>
      <p class="step-desc">Go to <strong>Settings → License</strong>. Paste your license key (from your previous email) and click <strong>Activate License</strong>. Your ${tierName} features unlock instantly.</p>
    </div>

    <div class="step-card">
      <span class="step-num">4</span><span class="step-title">Select a Folder to Scan</span>
      <p class="step-desc">Click the drive letter in the top-right corner to pick a folder. Then go to the <strong>PII Scanner</strong> tab and click <strong>Scan</strong>. The app will find all sensitive data in your files.</p>
    </div>

    <div class="step-card">
      <span class="step-num">5</span><span class="step-title">Review & Redact</span>
      <p class="step-desc">Review findings sorted by risk level. Select files and click <strong>Redact</strong> to automatically replace sensitive data. Original files are backed up automatically.</p>
    </div>

    <div class="step-card">
      <span class="step-num">6</span><span class="step-title">Generate Reports</span>
      <p class="step-desc">Export PDF audit certificates, CSV reports, and check compliance against GDPR, HIPAA, PCI-DSS, and more from the <strong>Compliance</strong> tab.</p>
    </div>

    <div class="warn-box">
      <div class="warn-title">⚠️ Windows SmartScreen Warning</div>
      <p class="warn-text">Since the app isn't code-signed yet, Windows may show "Windows protected your PC". Click <strong>"More info"</strong> → <strong>"Run anyway"</strong>. This is normal for unsigned desktop apps and your data is 100% safe.</p>
    </div>

    <div class="warn-box">
      <div class="warn-title">⚠️ License Activation Fails?</div>
      <p class="warn-text">• Make sure you're connected to the internet (one-time check only)<br>• Copy the key exactly as shown — it's AL-XXXX-XXXX-XXXX-XXXX<br>• If you see "device limit reached", go to Settings → Manage Devices to free a slot<br>• Contact support@adityalabs.ai if problems persist</p>
    </div>

    <div class="tip-box">
      <div class="tip-title">💡 Want AI Analysis? Install Ollama</div>
      <p class="tip-text">For AI-powered risk assessment and compliance analysis, install <strong>Ollama</strong> (free) from ollama.com. Then run <code>ollama pull llama3</code> in your terminal. The AI indicator in the app turns green when ready. All AI processing is 100% local.</p>
    </div>

    <a href="https://adityalabs.ai/lens/guide" class="btn">Interactive Getting Started Guide →</a>
    <a href="https://github.com/rrslt6d3/aditya-lens/releases/latest" class="btn-outline">Download Aditya Lens for Windows</a>

    <p style="color:#6b6b8a;font-size:.82rem;line-height:1.6;margin:1.5rem 0 0">Questions? Reply to this email or contact <a href="mailto:support@adityalabs.ai" style="color:#c4a265">support@adityalabs.ai</a>. We're here to help.</p>
  </div>
  <div class="foot">
    Aditya Lens by <a href="https://adityalabs.ai">Aditya Labs</a> &nbsp;|&nbsp;
    <a href="https://adityalabs.ai/lens">Product Page</a> &nbsp;|&nbsp;
    <a href="https://adityalabs.ai/lens/guide">Guide</a>
    <p style="margin:.5rem 0 0;color:#3d3d5c">&copy; 2026 Aditya Labs. All rights reserved.</p>
  </div>
</div></body></html>`,
  });
}

// ── Main Webhook Handler ────────────────────────────────────────────────────

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

  try {
    switch (event.type) {
      // ── New Checkout: Generate License Key ──────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerEmail = session.customer_details?.email || "";
        const customerName = session.customer_details?.name || "Valued Customer";
        const stripeCustomerId = session.customer || "";

        if (!customerEmail) return res.status(400).json({ error: "No email" });

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id || "";
        const tierLevel = PRICE_TO_TIER[priceId] ?? 0;
        const licenseKey = generateLicenseKey();

        const { error: dbError } = await supabase.from("license_keys").insert({
          key_string: licenseKey,
          is_active: true,
          tier_level: tierLevel,
          max_devices: TIER_DEVICES[tierLevel],
          customer_email: customerEmail,
          customer_name: customerName,
          stripe_customer: stripeCustomerId,
          stripe_price_id: priceId,
          device_ids: [],
          created_at: new Date().toISOString(),
        });

        if (dbError) {
          console.error("Supabase error:", dbError);
          return res.status(500).json({ error: "Database error" });
        }

        await sendLicenseEmail(customerEmail, customerName, licenseKey, tierLevel);
        // Send getting started guide email (non-blocking)
        sendGettingStartedEmail(customerEmail, customerName, TIER_NAMES[tierLevel]).catch(e => console.error("Getting started email failed:", e));
        console.log(`License issued: ${licenseKey} | Tier ${tierLevel} (${TIER_NAMES[tierLevel]}) | ${customerEmail}`);
        break;
      }

      // ── Subscription Created (redundancy for Stripe flow) ──────
      case "customer.subscription.created": {
        const sub = event.data.object;
        const priceId = sub.items.data[0]?.price?.id || "";
        const stripeCustomerId = sub.customer;

        // Check if license already exists (from checkout.session.completed)
        const { data: existing } = await supabase
          .from("license_keys")
          .select("id")
          .eq("stripe_customer", stripeCustomerId)
          .eq("is_active", true)
          .limit(1);

        if (existing && existing.length > 0) {
          // License already issued via checkout — skip
          console.log(`Subscription created for ${stripeCustomerId} — license already exists`);
          break;
        }

        // Issue license if missing
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        const tierLevel = PRICE_TO_TIER[priceId] ?? 0;
        const licenseKey = generateLicenseKey();

        await supabase.from("license_keys").insert({
          key_string: licenseKey,
          is_active: true,
          tier_level: tierLevel,
          max_devices: TIER_DEVICES[tierLevel],
          customer_email: customer.email || "",
          customer_name: customer.name || "Valued Customer",
          stripe_customer: stripeCustomerId,
          stripe_price_id: priceId,
          device_ids: [],
          created_at: new Date().toISOString(),
        });

        await sendLicenseEmail(customer.email, customer.name || "Valued Customer", licenseKey, tierLevel);
        sendGettingStartedEmail(customer.email, customer.name || "Valued Customer", TIER_NAMES[tierLevel]).catch(e => console.error("Getting started email failed:", e));
        console.log(`License issued (sub): ${licenseKey} | Tier ${tierLevel} | ${customer.email}`);
        break;
      }

      // ── Subscription Updated (upgrade/downgrade) ───────────────
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const priceId = sub.items.data[0]?.price?.id || "";
        const stripeCustomerId = sub.customer;
        const newTier = PRICE_TO_TIER[priceId] ?? 0;

        const { error } = await supabase
          .from("license_keys")
          .update({
            tier_level: newTier,
            max_devices: TIER_DEVICES[newTier],
            stripe_price_id: priceId,
          })
          .eq("stripe_customer", stripeCustomerId)
          .eq("is_active", true);

        if (error) console.error("Tier update failed:", error);
        else console.log(`Tier updated: ${stripeCustomerId} → ${TIER_NAMES[newTier]}`);
        break;
      }

      // ── Subscription Cancelled ─────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const stripeCustomerId = sub.customer;

        const { data, error } = await supabase
          .from("license_keys")
          .update({
            is_active: false,
            deactivated_at: new Date().toISOString(),
            deactivation_reason: "subscription_cancelled",
          })
          .eq("stripe_customer", stripeCustomerId)
          .eq("is_active", true)
          .select();

        if (data && data.length > 0) {
          const tierName = TIER_NAMES[data[0].tier_level] || "Solo";
          await sendCancellationEmail(data[0].customer_email, data[0].customer_name, tierName);
        }
        console.log(`Subscription cancelled: ${stripeCustomerId}`);
        break;
      }

      // ── Payment Failed ─────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;
        const attemptCount = invoice.attempt_count || 1;

        if (attemptCount >= 3) {
          await supabase
            .from("license_keys")
            .update({
              is_active: false,
              deactivated_at: new Date().toISOString(),
              deactivation_reason: "payment_failed",
            })
            .eq("stripe_customer", stripeCustomerId)
            .eq("is_active", true);
          console.log(`License deactivated after ${attemptCount} failed payments: ${stripeCustomerId}`);
        } else {
          const { data } = await supabase
            .from("license_keys")
            .select("customer_email, customer_name")
            .eq("stripe_customer", stripeCustomerId)
            .single();
          if (data) await sendPaymentFailureEmail(data.customer_email, data.customer_name, attemptCount);
        }
        break;
      }

      // ── Invoice Paid (reactivation after failure) ──────────────
      case "invoice.paid": {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;

        await supabase
          .from("license_keys")
          .update({ is_active: true, deactivated_at: null, deactivation_reason: null })
          .eq("stripe_customer", stripeCustomerId)
          .eq("deactivation_reason", "payment_failed");
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
}

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}
