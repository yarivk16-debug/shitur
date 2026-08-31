const AIRTABLE_API_ROOT = "https://api.airtable.com/v0";
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function cleanTablePath(value) {
  const path = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  if (!path || path.includes("..") || !/^[A-Za-z0-9_\-/]+$/.test(path)) return "";
  return path.split("/").map(encodeURIComponent).join("/");
}

module.exports = async function airtableProxy(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    return sendJson(response, 500, { error: "Airtable environment variables are not configured" });
  }

  const { table, method = "GET", params = {}, body = null } = request.body || {};
  const tablePath = cleanTablePath(table);
  const upstreamMethod = String(method).toUpperCase();
  if (!tablePath || !ALLOWED_METHODS.has(upstreamMethod) || !params || typeof params !== "object" || Array.isArray(params)) {
    return sendJson(response, 400, { error: "Invalid Airtable request" });
  }

  const url = new URL(`${AIRTABLE_API_ROOT}/${encodeURIComponent(baseId)}/${tablePath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
    else url.searchParams.set(key, String(value));
  });

  try {
    const upstream = await fetch(url, {
      method: upstreamMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: upstreamMethod === "GET" || upstreamMethod === "DELETE" || body === null ? undefined : JSON.stringify(body)
    });
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    response.end(text);
  } catch (error) {
    sendJson(response, 502, { error: "Airtable request failed" });
  }
};
