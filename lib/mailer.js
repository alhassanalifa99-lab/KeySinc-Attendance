import nodemailer from "nodemailer";

const TIME_ZONE = "Africa/Accra";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function sessionDate(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export async function sendAttendanceEmail({ to, course, session, count, pdfBuffer }) {
  if (!course.lecturer_email) {
    throw new Error("No lecturer email set for this course");
  }

  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  if (!user || !password) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured");
  }

  const courseCode = course.course_code ?? course.courseCode;
  const courseName = course.course_name ?? course.courseName;
  const sessionId = session.id;
  const createdAt = session.created_at ?? session.createdAt;
  const date = sessionDate(createdAt);
  const safeCode = String(courseCode).replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename = `Attendance-${safeCode}-${date}.pdf`;
  const escapedCode = escapeHtml(courseCode);
  const escapedName = escapeHtml(courseName);
  const escapedVenue = escapeHtml(course.venue);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
  });

  return transporter.sendMail({
    from: {
      name: process.env.MAIL_FROM_NAME || "KeySinc Attendance",
      address: user,
    },
    to: to || course.lecturer_email,
    subject: `Attendance report: ${courseCode} (${date})`,
    text: [
      `Attached is the attendance report for ${courseCode} - ${courseName}.`,
      `Venue: ${course.venue}`,
      `Date: ${date} (Africa/Accra)`,
      `Total attendance: ${count}`,
      `Session: ${sessionId}`,
    ].join("\n"),
    html: `<p>Attached is the attendance report for <strong>${escapedCode} - ${escapedName}</strong>.</p><p>Venue: ${escapedVenue}<br>Date: ${date} (Africa/Accra)<br>Total attendance: ${count}</p>`,
    attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
  });
}