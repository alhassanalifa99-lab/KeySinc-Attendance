// app/api/attendance/signin/route.js
// POST /api/attendance/signin
// Body: { sessionId: string(uuid), indexNumber: string, deviceFingerprint: string }

import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function fail(status, code, message) {
  return json({ ok: false, code, message }, status);
}

// Trim, collapse inner whitespace, upper-case. Must match how students are stored.
function normaliseIndex(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export async function POST(request) {
  // ---- 1. Parse + validate input ------------------------------------
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_REQUEST', 'Invalid request.');
  }

  const sessionId = String(body?.sessionId ?? '').trim();
  const indexNumber = normaliseIndex(body?.indexNumber);
  const deviceFingerprint = String(body?.deviceFingerprint ?? '').trim();

  if (!UUID_RE.test(sessionId)) {
    return fail(400, 'BAD_SESSION', 'This attendance link is not valid.');
  }
  if (indexNumber.length < 3 || indexNumber.length > 32) {
    return fail(400, 'BAD_INDEX', 'Please enter a valid index number.');
  }
  if (deviceFingerprint.length < 16 || deviceFingerprint.length > 128) {
    return fail(400, 'BAD_DEVICE', 'Could not identify your device. Refresh the page and try again.');
  }

  try {
    // ---- 2. Session must exist and be active ------------------------
    const sessionRes = await query(
      `SELECT s.is_active, c.course_name
         FROM sessions s
         JOIN courses c ON c.id = s.course_id
        WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      return fail(404, 'SESSION_NOT_FOUND', 'This attendance session does not exist.');
    }
    const { is_active: isActive, course_name: courseName } = sessionRes.rows[0];
    if (!isActive) {
      return fail(410, 'SESSION_CLOSED', 'Attendance for this class has been closed.');
    }

    // ---- 3. Index number must be on the master list -----------------
    const studentRes = await query(
      'SELECT full_name FROM students WHERE index_number = $1',
      [indexNumber]
    );
    if (studentRes.rowCount === 0) {
      return fail(404, 'STUDENT_NOT_FOUND', 'Index number not found. Check it and try again.');
    }
    const fullName = studentRes.rows[0].full_name;

    // ---- 4. Insert (guarded so a session closed a moment ago is rejected)
    const insertRes = await query(
      `INSERT INTO attendance_logs (session_id, index_number, device_fingerprint)
       SELECT s.id, $2, $3
         FROM sessions s
        WHERE s.id = $1 AND s.is_active = TRUE
       RETURNING signed_at`,
      [sessionId, indexNumber, deviceFingerprint]
    );

    if (insertRes.rowCount === 0) {
      return fail(410, 'SESSION_CLOSED', 'Attendance for this class has just been closed.');
    }

    return json({
      ok: true,
      message: 'Attendance recorded.',
      fullName,
      indexNumber,
      courseName,
      signedAt: insertRes.rows[0].signed_at,
    });
  } catch (err) {
    // ---- 5. Unique-violation handling -------------------------------
    if (err?.code === '23505') {
      if (err.constraint === 'attendance_unique_device') {
        return fail(
          409,
          'DEVICE_ALREADY_USED',
          'This phone has already been used to sign in for this class. Each student must use their own phone.'
        );
      }
      // attendance_unique_student (or any other unique violation)
      return fail(409, 'ALREADY_SIGNED_IN', 'You have already signed in for this class.');
    }

    // Foreign-key violation: student removed between the check and the insert.
    if (err?.code === '23503') {
      return fail(404, 'STUDENT_NOT_FOUND', 'Index number not found. Check it and try again.');
    }

    console.error('[signin] Unexpected error:', err);
    return fail(500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
  }
}