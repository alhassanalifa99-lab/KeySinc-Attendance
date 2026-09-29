import { requireAdmin } from "../../../../../../lib/adminAuth";
import { emailClosedAttendanceReport } from "../../../../../../lib/attendanceReport";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "A valid session is required." }, { status: 400 });
  }

  try {
    const result = await emailClosedAttendanceReport(id);
    if (!result.ok) {
      return Response.json({ error: result.message }, { status: result.status });
    }
    return Response.json(result);
  } catch (error) {
    console.error("[attendance-email] Resend failed:", error);
    return Response.json({
      ok: true,
      emailed: false,
      message: error instanceof Error ? error.message : "PDF generation or email delivery failed.",
    });
  }
}