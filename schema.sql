-- =====================================================================
-- Class Attendance App — Neon PostgreSQL schema
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COURSES (one row per timetable slot)
-- day_of_week uses ISO numbering: 1 = Monday ... 7 = Sunday
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_code    TEXT     NOT NULL UNIQUE,
  course_name    TEXT     NOT NULL,
  venue          TEXT     NOT NULL,
  lecturer_email TEXT,                      -- fill in via admin UI / UPDATE before first close
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time     TIME     NOT NULL,
  end_time       TIME     NOT NULL,
  CONSTRAINT courses_time_order CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------
-- STUDENTS (master list; index_number is the natural key)
-- Index numbers are stored trimmed + upper-cased by the app before insert.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  index_number TEXT NOT NULL UNIQUE,
  full_name    TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- SESSIONS (one row per opened class)
-- UUID id so the student link (/class/<uuid>) can't be guessed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       BIGINT      NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  pdf_emailed_at  TIMESTAMPTZ,              -- set once the report has been emailed
  CONSTRAINT sessions_active_matches_closed
    CHECK ((is_active AND closed_at IS NULL) OR (NOT is_active AND closed_at IS NOT NULL))
);

-- Only ONE active session per course at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_active_session_per_course
  ON sessions (course_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_sessions_course_created
  ON sessions (course_id, created_at DESC);

-- ---------------------------------------------------------------------
-- ATTENDANCE LOGS
-- Two unique constraints per session:
--   * one sign-in per index number
--   * one sign-in per device fingerprint (blocks proxy sign-ins)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_logs (
  session_id         UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  index_number       TEXT        NOT NULL REFERENCES students(index_number) ON UPDATE CASCADE ON DELETE RESTRICT,
  device_fingerprint TEXT        NOT NULL,
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_unique_student UNIQUE (session_id, index_number),
  CONSTRAINT attendance_unique_device  UNIQUE (session_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session_signed
  ON attendance_logs (session_id, signed_at);

-- ---------------------------------------------------------------------
-- SEED: official timetable
-- NOTE: course_code values are PLACEHOLDERS — replace with your real codes.
--       lecturer_email is left NULL until you set it (see UPDATE examples below).
-- ---------------------------------------------------------------------
INSERT INTO courses (course_code, course_name, venue, day_of_week, start_time, end_time) VALUES
  ('SOB-301', 'Quantitative Research Method',      'L.H.2', 1, '13:45', '15:45'),  -- Monday
  ('HRM-305', 'Law and Procedures of Meetings',    'L.H.2', 1, '17:55', '19:55'),  -- Monday
  ('HRM-303', 'Strategic HRM',                     'L.H.1', 2, '09:35', '11:35'),  -- Tuesday
  ('HRM-301', 'Change Management',                 'L.H.1', 2, '13:45', '15:45'),  -- Tuesday
  ('BIS-307', 'Management Information System',     'L.H.2', 3, '07:30', '09:30'),  -- Wednesday
  ('HRM=307', 'Recruitment and Staffing',          'L.H.1', 5, '17:55', '19:55')   -- Friday
ON CONFLICT (course_code) DO NOTHING;

-- ---------------------------------------------------------------------
-- Examples (run separately, after replacing values):
--
-- UPDATE courses SET lecturer_email = 'lecturer@example.com' WHERE course_code = 'QRM-101';
-- UPDATE courses SET course_code = 'REAL-CODE' WHERE course_code = 'QRM-101';
--
-- INSERT INTO students (index_number, full_name) VALUES
--   ('UDS/XXX/0001/00', 'Student Name')
-- ON CONFLICT (index_number) DO NOTHING;
-- ---------------------------------------------------------------------
