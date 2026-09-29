import QRCode from "qrcode";
import { requireAdmin } from "../../../../lib/adminAuth";
import { query } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { rows } = await query(
    `WITH calendar AS (
       SELECT EXTRACT(ISODOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Accra'))::int AS today_day_of_week
     )
     SELECT c.id, c.course_code, c.course_name, c.venue, c.day_of_week,
            c.start_time, c.end_time, calendar.today_day_of_week,
            s.id AS session_id, s.created_at AS session_created_at,
            (SELECT COUNT(*)::int FROM attendance_logs a WHERE a.session_id = s.id) AS attendance_count
       FROM courses c
       CROSS JOIN calendar
       LEFT JOIN sessions s ON s.course_id = c.id AND s.is_active = TRUE
      ORDER BY c.day_of_week, c.start_time, c.course_code`,
  );

  const courses = await Promise.all(
    rows.map(async (row) => {
      if (!row.session_id) {
        return {
          id: row.id,
          courseCode: row.course_code,
          courseName: row.course_name,
          venue: row.venue,
          dayOfWeek: row.day_of_week,
          startTime: row.start_time,
          endTime: row.end_time,
          isToday: row.day_of_week === row.today_day_of_week,
          activeSession: null,
        };
      }

      const studentUrl = new URL(`/class/${row.session_id}`, request.url).toString();
      const qrCode = await QRCode.toDataURL(studentUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 240,
      });

      return {
        id: row.id,
        courseCode: row.course_code,
        courseName: row.course_name,
        venue: row.venue,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        isToday: row.day_of_week === row.today_day_of_week,
        activeSession: {
          id: row.session_id,
          createdAt: row.session_created_at,
          attendanceCount: row.attendance_count,
          studentUrl,
          qrCode,
        },
      };
    }),
  );

  const historyResult = await query(
    `SELECT s.id, s.course_id, s.created_at, s.closed_at, s.pdf_emailed_at,
            c.course_code, c.course_name,
            (SELECT COUNT(*)::int FROM attendance_logs a WHERE a.session_id = s.id) AS attendance_count
       FROM sessions s
       JOIN courses c ON c.id = s.course_id
      WHERE s.is_active = FALSE
      ORDER BY s.closed_at DESC
      LIMIT 50`,
  );

  return Response.json({
    todayDayOfWeek: rows[0]?.today_day_of_week ?? null,
    courses,
    pastSessions: historyResult.rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      pdfEmailedAt: row.pdf_emailed_at,
      attendanceCount: row.attendance_count,
    })),
  });
}