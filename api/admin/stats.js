import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TIER_PRICES = { 1: 99, 2: 249, 3: 499, 4: 999 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: licenses } = await supabase
      .from("license_keys")
      .select("tier_level, is_active, created_at, deactivation_reason");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const active = licenses.filter(l => l.is_active);
    const mrr = active.reduce((sum, l) => sum + (TIER_PRICES[l.tier_level] || 0), 0);

    return res.status(200).json({
      total_licenses: licenses.length,
      active_licenses: active.length,
      inactive_licenses: licenses.length - active.length,
      by_tier: {
        solo: active.filter(l => l.tier_level === 1).length,
        professional: active.filter(l => l.tier_level === 2).length,
        business: active.filter(l => l.tier_level === 3).length,
        enterprise: active.filter(l => l.tier_level === 4).length,
      },
      mrr,
      arr: mrr * 12,
      new_this_month: licenses.filter(l => new Date(l.created_at) >= monthStart).length,
      churned_this_month: licenses.filter(l =>
        !l.is_active && l.deactivation_reason === "subscription_cancelled" &&
        new Date(l.created_at) >= monthStart
      ).length,
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
}
