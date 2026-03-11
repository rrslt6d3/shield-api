import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-License-Key");
  if (req.method === "OPTIONS") return res.status(200).end();

  const licenseKey = req.headers["x-license-key"];
  if (!licenseKey) return res.status(401).json({ error: "Missing X-License-Key header" });

  const { data, error } = await supabase
    .from("license_keys")
    .select("id, device_ids, tier_level, max_devices")
    .eq("key_string", licenseKey)
    .eq("is_active", true)
    .single();

  if (error || !data) return res.status(404).json({ error: "License not found" });

  const maxDevices = data.max_devices || { 1: 1, 2: 3, 3: 5, 4: 25 }[data.tier_level] || 1;

  // GET — list bound devices
  if (req.method === "GET") {
    return res.status(200).json({
      devices: (data.device_ids || []).map((id, i) => ({ device_id: id, index: i })),
      count: (data.device_ids || []).length,
      max: maxDevices,
    });
  }

  // DELETE — remove a device
  if (req.method === "DELETE") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { device_id } = body;
    if (!device_id) return res.status(400).json({ error: "Missing device_id" });

    const updated = (data.device_ids || []).filter(id => id !== device_id);
    await supabase.from("license_keys").update({ device_ids: updated }).eq("id", data.id);

    return res.status(200).json({ success: true, remaining_devices: updated.length, max: maxDevices });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
