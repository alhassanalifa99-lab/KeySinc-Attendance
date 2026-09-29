const SESSION_COOKIE = "keysinc_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;
const encoder = new TextEncoder();

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSigningKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function getCookieValue(request, cookieName) {
  const nextCookie = request.cookies?.get(cookieName)?.value;
  if (nextCookie) return nextCookie;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const entry = cookieHeader.split(";").find((part) => part.trim().startsWith(`${cookieName}=`));
  return entry ? entry.trim().slice(cookieName.length + 1) : null;
}

export async function createAdminSessionToken() {
  const key = await getSigningKey();
  if (!key) throw new Error("ADMIN_SESSION_SECRET is not configured.");

  const payload = encodeBase64Url(
    encoder.encode(JSON.stringify({ sub: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })),
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function requireAdmin(request) {
  const token = getCookieValue(request, SESSION_COOKIE);
  if (!token) return false;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;

  try {
    const key = await getSigningKey();
    if (!key) return false;

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      encoder.encode(payload),
    );
    if (!validSignature) return false;

    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return session.sub === "admin" && Number.isInteger(session.exp) && session.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function adminSessionCookie(token, maxAge = SESSION_MAX_AGE) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export { SESSION_COOKIE };