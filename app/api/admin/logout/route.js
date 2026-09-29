import { adminSessionCookie, requireAdmin } from "../../../../lib/adminAuth";

export async function POST(request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return Response.json(
    { success: true },
    { headers: { "Set-Cookie": adminSessionCookie("", 0) } },
  );
}