import { requireAdmin } from "../../../../../lib/adminAuth";
import { emailClosedAttendanceReport } from "../../../../../lib/attendanceReport";
import { withTransaction } from "../../../../../lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let sessionId;
  try {
    ({ sessionId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return Response.json({ error: "A valid session is required." }, { status: 400 });
  }

  const result = await withTransaction((client) =>
    client.query(
      `UPDATE sessions
          SET is_active = FALSE, closed_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = TRUE
        RETURNING id, course_id, created_at, closed_at`,
      [sessionId],
    ),
  );

  if (!result.rowCount) {
    return Response.json({ error: "Open session not found." }, { status: 404 });
  }

  try {
    const report = await emailClosedAttendanceReport(sessionId);
    return Response.json(report);
  } catch (error) {
    console.error("[attendance-email] Report delivery failed:", error);
    return Response.json({
      ok: true,
      emailed: false,
      message: error instanceof Error ? error.message : "PDF generation or email delivery failed.",
    });
  }
}