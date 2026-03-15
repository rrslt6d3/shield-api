import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── In-memory rate limiter (per IP, 10 attempts per minute) ─────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ── Tier config ─────────────────────────────────────────────────────────────
const TIER_NAMES   = { 0: "Starter", 1: "Solo", 2: "Professional", 3: "Business", 4: "Enterprise" };
const TIER_DEVICES = { 0: 1, 1: 1, 2: 3, 3: 10, 4: 25 };

const TIER_FEATURES = {
  0: {
    search: true, content_search: true, pii_filters: 6, dashboard: true,
    analytics: true, duplicates: true, bookmarks: true, redaction: true,
    compliance: false, ai_analysis: false, watch_folder: false,
    batch: false, image_redact: false, schedules: false,
    audio: false, api_server: false, rbac: false, custom_frameworks: false,
  },
  1: {
    search: true, content_search: true, pii_filters: 15, dashboard: true,
    analytics: true, duplicates: true, bookmarks: true, redaction: true,
    compliance: true, ai_analysis: true, watch_folder: true,
    custom_patterns: true, profiles: true, pdf_audit: true, regex_playground: true,
    batch: false, image_redact: false, schedules: false,
    audio: false, api_server: false, rbac: false, custom_frameworks: false,
  },
  2: {
    search: true, content_search: true, pii_filters: 15, dashboard: true,
    analytics: true, duplicates: true, bookmarks: true, redaction: true,
    compliance: true, ai_analysis: true, watch_folder: true,
    custom_patterns: true, profiles: true, pdf_audit: true, regex_playground: true,
    batch: true, schedules: true, doc_compare: true, scan_stats: true,
    image_redact: false, audio: false, api_server: false, rbac: false, custom_frameworks: false,
  },
  3: {
    search: true, content_search: true, pii_filters: 39, dashboard: true,
    analytics: true, duplicates: true, bookmarks: true, redaction: true,
    compliance: true, ai_analysis: true, watch_folder: true,
    custom_patterns: true, profiles: true, pdf_audit: true, regex_playground: true,
    batch: true, image_redact: true, schedules: true, doc_compare: true, scan_stats: true,
    api_server: true, custom_frameworks: true, audit_export: true,
    dsar: true, retention: true, reports: true, incidents: true, data_map: true,
    subjects: true, dpia: true, breach_sim: true, calendar: true, remediation: true,
    ropa: true, cross_ref: true, gap_analysis: true, compliance_pkg: true,
    max_seats: 10,
    audio: false, rbac: false,
  },
  4: {
    search: true, content_search: true, pii_filters: 39, dashboard: true,
    analytics: true, duplicates: true, bookmarks: true, redaction: true,
    compliance: true, ai_analysis: true, watch_folder: true,
    custom_patterns: true, profiles: true, pdf_audit: true, regex_playground: true,
    batch: true, image_redact: true, schedules: true, doc_compare: true, scan_stats: true,
    audio: true, api_server: true, rbac: true, custom_frameworks: true, audit_export: true,
    whitelabel: true, webhooks: true, encrypted_exports: true, compliance_trends: true,
    exec_reports: true, multi_folder: true,
    dsar: true, retention: true, reports: true, incidents: true, data_map: true,
    subjects: true, dpia: true, breach_sim: true, calendar: true, remediation: true,
    ropa: true, cross_ref: true, gap_analysis: true, compliance_pkg: true,
    exec_dash: true, clipboard_guard: true, scheduled_reports: true,
    max_seats: 25,
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limit
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Try again in 1 minute." });
  }

  const { license_key, device_id } = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

  if (!license_key || typeof license_key !== "string") {
    return res.status(400).json({ valid: false, error: "Missing license_key" });
  }

  // Validate format: AL-XXXX-XXXX-XXXX-XXXX
  if (!/^AL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(license_key)) {
    return res.status(400).json({ valid: false, error: "Invalid key format" });
  }

  try {
    const { data, error } = await supabase
      .from("license_keys")
      .select("*")
      .eq("key_string", license_key)
      .single();

    if (error || !data) {
      return res.status(404).json({ valid: false, error: "License key not found" });
    }

    if (!data.is_active) {
      const reason = data.deactivation_reason === "payment_failed"
        ? "Payment failed — please update your payment method"
        : data.deactivation_reason === "subscription_cancelled"
          ? "Subscription cancelled — resubscribe to reactivate"
          : "License key has been deactivated";
      return res.status(403).json({ valid: false, error: reason });
    }

    // Check expiry if set
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.status(403).json({ valid: false, error: "License key has expired" });
    }

    // ── Device binding ──────────────────────────────────────────
    const maxDevices = data.max_devices || TIER_DEVICES[data.tier_level] || 1;
    const currentDevices = data.device_ids || [];

    if (device_id) {
      if (!currentDevices.includes(device_id)) {
        if (currentDevices.length >= maxDevices) {
          return res.status(403).json({
            valid: false,
            error: `Device limit reached (${maxDevices} for ${TIER_NAMES[data.tier_level]}). Go to Settings → Manage Devices to free a slot.`,
            device_limit: true,
            max_devices: maxDevices,
            current_devices: currentDevices.length,
          });
        }
        // Register new device
        await supabase
          .from("license_keys")
          .update({
            device_ids: [...currentDevices, device_id],
            last_validated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
      } else {
        // Existing device — just update timestamp
        await supabase
          .from("license_keys")
          .update({ last_validated_at: new Date().toISOString() })
          .eq("id", data.id);
      }
    }

    return res.status(200).json({
      valid: true,
      tier: data.tier_level,
      tier_name: TIER_NAMES[data.tier_level],
      customer_email: data.customer_email,
      features: TIER_FEATURES[data.tier_level] || TIER_FEATURES[0],
      activated_devices: currentDevices.length + (device_id && !currentDevices.includes(device_id) ? 1 : 0),
      max_devices: maxDevices,
    });
  } catch (err) {
    console.error("Validation error:", err);
    return res.status(500).json({ valid: false, error: "Internal server error" });
  }
}
