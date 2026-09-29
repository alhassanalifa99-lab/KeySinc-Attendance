import { requireAdmin } from "../../../../../lib/adminAuth";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  if (!(await requireAdmin(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let courseId;
  try {
    ({ courseId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof courseId !== "string" && typeof courseId !== "number") {
    return Response.json({ error: "A valid course is required." }, { status: 400 });
  }
  courseId = String(courseId);
  if (!/^\d+$/.test(courseId)) {
    return Response.json({ error: "A valid course is required." }, { status: 400 });
  }

  let inserted;
  try {
    inserted = await query(
      `INSERT INTO sessions (course_id)
       VALUES ($1)
       ON CONFLICT (course_id) WHERE is_active DO NOTHING
       RETURNING id, course_id, created_at`,
      [courseId],
    );
  } catch (error) {
    if (error?.code === "23503") {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }
    throw error;
  }

  if (inserted.rowCount) {
    return Response.json({ session: inserted.rows[0] }, { status: 201 });
  }

  const existing = await query(
    `SELECT id, course_id, created_at
       FROM sessions
      WHERE course_id = $1 AND is_active = TRUE`,
    [courseId],
  );

  if (existing.rowCount) {
    return Response.json(
      { error: "This course already has an open session.", session: existing.rows[0] },
      { status: 409 },
    );
  }

  return Response.json({ error: "Course not found." }, { status: 404 });
}