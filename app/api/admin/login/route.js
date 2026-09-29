import { adminSessionCookie, createAdminSessionToken } from "../../../../lib/adminAuth";

async function passwordsMatch(candidate, configured) {
  const [candidateHash, configuredHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(configured)),
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(configuredHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function POST(request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || !process.env.ADMIN_SESSION_SECRET) {
    return Response.json({ error: "Admin authentication is not configured." }, { status: 503 });
  }

  let password;
  try {
    ({ password } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof password !== "string" || !(await passwordsMatch(password, configuredPassword))) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  return Response.json(
    { success: true },
    { headers: { "Set-Cookie": adminSessionCookie(token) } },
  );
}