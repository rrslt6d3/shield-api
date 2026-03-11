import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Admin auth
  if (req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // GET — List/search licenses
  if (req.method === "GET") {
    const { tier, active, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from("license_keys")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (tier) query = query.eq("tier_level", parseInt(tier));
    if (active !== undefined) query = query.eq("is_active", active === "true");
    if (search) query = query.or(`customer_email.ilike.%${search}%,key_string.ilike.%${search}%,customer_name.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      licenses: data,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
    });
  }

  // PATCH — Activate/deactivate a license
  if (req.method === "PATCH") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { license_id, action } = body;

    if (!license_id || !["activate", "deactivate"].includes(action)) {
      return res.status(400).json({ error: "Missing license_id or invalid action (activate|deactivate)" });
    }

    const updates = action === "deactivate"
      ? { is_active: false, deactivated_at: new Date().toISOString(), deactivation_reason: "admin_revoked" }
      : { is_active: true, deactivated_at: null, deactivation_reason: null };

    const { error } = await supabase.from("license_keys").update(updates).eq("id", license_id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, action });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
