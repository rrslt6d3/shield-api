import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { license_key } = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  if (!license_key) return res.status(400).json({ error: "Missing license_key" });

  try {
    const { data, error } = await supabase
      .from("license_keys")
      .select("stripe_customer")
      .eq("key_string", license_key)
      .eq("is_active", true)
      .single();

    if (error || !data?.stripe_customer) {
      return res.status(404).json({ error: "License not found or inactive" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer,
      return_url: "https://adityalabs.ai/lens",
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
}
