export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    status: "ok",
    service: "shield-api",
    version: "1.2.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/health",
      "/api/validate-license",
      "/api/stripe-webhook",
      "/api/create-portal-session",
      "/api/devices",
    ],
  });
}
