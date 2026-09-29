import { query } from "./db";
import { sendAttendanceEmail } from "./mailer";
import { buildAttendancePdf } from "./pdf";

export async function emailClosedAttendanceReport(sessionId) {
  const sessionResult = await query(
    `SELECT s.id, s.course_id, s.is_active, s.created_at, s.closed_at, s.pdf_emailed_at,
            c.course_code, c.course_name, c.venue, c.lecturer_email, c.start_time, c.end_time
       FROM sessions s
       JOIN courses c ON c.id = s.course_id
      WHERE s.id = $1`,
    [sessionId],
  );

  if (!sessionResult.rowCount) {
    return { ok: false, status: 404, message: "Session not found." };
  }

  const session = sessionResult.rows[0];
  if (session.is_active || !session.closed_at) {
    return { ok: false, status: 409, message: "Only closed sessions can be emailed." };
  }
  if (!session.lecturer_email) {
    return { ok: true, emailed: false, message: "No lecturer email set for this course" };
  }

  const { rows } = await query(
    `SELECT a.index_number, s.full_name, a.signed_at
       FROM attendance_logs a
       JOIN students s ON s.index_number = a.index_number
      WHERE a.session_id = $1
      ORDER BY a.signed_at`,
    [sessionId],
  );
  const course = {
    course_code: session.course_code,
    course_name: session.course_name,
    venue: session.venue,
    lecturer_email: session.lecturer_email,
    start_time: session.start_time,
    end_time: session.end_time,
  };

  const pdfBuffer = await buildAttendancePdf({ course, session, rows });
  await sendAttendanceEmail({
    to: course.lecturer_email,
    course,
    session,
    count: rows.length,
    pdfBuffer,
  });

  await query(
    `UPDATE sessions
        SET pdf_emailed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = FALSE`,
    [sessionId],
  );

  return { ok: true, emailed: true, message: "Attendance PDF emailed to the lecturer." };
}