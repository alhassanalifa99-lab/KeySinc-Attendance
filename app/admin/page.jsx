"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

async function loadSessionData() {
  const response = await fetch("/api/admin/session", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load session data.");
  return result;
}

function formatTime(value) {
  return String(value).slice(0, 5);
}

const weekdays = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workingCourse, setWorkingCourse] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [copiedSession, setCopiedSession] = useState(null);
  const actionInProgress = useRef(false);
  const courses = data?.courses ?? [];
  const hasActiveSession = courses.some((course) => course.activeSession);

  useEffect(() => {
    let cancelled = false;
    loadSessionData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasActiveSession) return;

    let cancelled = false;
    const interval = window.setInterval(() => {
      if (document.hidden || actionInProgress.current) return;
      loadSessionData()
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch(() => {});
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasActiveSession]);

  async function refresh() {
    const result = await loadSessionData();
    setData(result);
  }

  async function changeSession(action, course) {
    if (
      action === "close" &&
      !window.confirm(`Close ${course.courseCode} and email the attendance PDF to the lecturer?`)
    ) {
      return;
    }

    actionInProgress.current = true;
    setWorkingCourse(course.id);
    setError("");
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/session/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "open"
            ? { courseId: String(course.id) }
            : { sessionId: course.activeSession.id },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Session update failed.");
      await refresh().catch(() => {});
      if (action === "close") {
        setNotice({
          type: result.emailed ? "success" : "warning",
          text: result.emailed
            ? result.message
            : `Session closed. Email was not sent: ${result.message}`,
        });
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      actionInProgress.current = false;
      setWorkingCourse(null);
    }
  }

  async function resendReport(session) {
    actionInProgress.current = true;
    setWorkingCourse(`resend-${session.id}`);
    setError("");
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/sessions/${session.id}/resend`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Email resend failed.");
      await refresh().catch(() => {});
      setNotice({
        type: result.emailed ? "success" : "warning",
        text: result.emailed ? result.message : `Email was not sent: ${result.message}`,
      });
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      actionInProgress.current = false;
      setWorkingCourse(null);
    }
  }

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  async function copyStudentUrl(session) {
    try {
      await navigator.clipboard.writeText(session.studentUrl);
      setError("");
      setCopiedSession(session.id);
      window.setTimeout(() => setCopiedSession(null), 1600);
    } catch {
      setError("Could not copy the link. Select it and copy it manually.");
    }
  }

  const todayCourses = courses.filter((course) => course.isToday);
  const otherCourses = courses.filter((course) => !course.isToday);

  function renderCourse(course) {
    const session = course.activeSession;
    const isWorking = workingCourse === course.id;

    return (
      <article key={course.id} className="border-b border-[#e3e9e5] bg-white p-5 last:border-0 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#55766a]">{course.courseCode}</span>
              {session ? (
                <span className="bg-[#e5f2eb] px-2 py-1 text-xs font-medium text-[#23724f]">Session open</span>
              ) : (
                <span className="bg-[#eff2f0] px-2 py-1 text-xs font-medium text-[#718078]">No active session</span>
              )}
            </div>
            <h3 className="text-lg font-semibold">{course.courseName}</h3>
            <p className="mt-1 text-sm text-[#65756e]">
              {course.venue} <span className="px-1 text-[#a1ada6]">/</span> {weekdays[course.dayOfWeek]} <span className="px-1 text-[#a1ada6]">/</span> {formatTime(course.startTime)}-{formatTime(course.endTime)}
            </p>
          </div>

          {session ? (
            <button
              type="button"
              disabled={Boolean(workingCourse)}
              onClick={() => changeSession("close", course)}
              className="min-h-10 shrink-0 bg-[#a53f35] px-4 text-sm font-semibold text-white transition hover:bg-[#87332b] disabled:opacity-60"
            >
              {isWorking ? "Closing & emailing..." : "Close & email lecturer"}
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(workingCourse) || loading}
              onClick={() => changeSession("open", course)}
              className="min-h-10 shrink-0 bg-[#245c4b] px-4 text-sm font-semibold text-white transition hover:bg-[#194938] disabled:opacity-60"
            >
              {isWorking ? "Opening..." : "Open session"}
            </button>
          )}
        </div>

        {session && (
          <div className="mt-5 grid gap-5 border-t border-[#edf1ee] pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <p className="text-sm text-[#41574e]">
                {session.attendanceCount} {session.attendanceCount === 1 ? "student" : "students"} signed in
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[#718078]">{session.studentUrl}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <a className="font-medium text-[#245c4b] underline underline-offset-4" href={session.studentUrl} target="_blank" rel="noreferrer">
                  Open student page
                </a>
                <button
                  type="button"
                  onClick={() => copyStudentUrl(session)}
                  className="font-medium text-[#245c4b] underline underline-offset-4"
                >
                  {copiedSession === session.id ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
            <Image
              src={session.qrCode}
              alt={`Attendance QR code for ${course.courseCode}`}
              width={144}
              height={144}
              unoptimized
              className="size-36 border border-[#e0e7e2] bg-white p-1"
            />
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f5f4] text-[#172b27]">
      <header className="border-b border-[#dce4df] bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center bg-[#245c4b] text-sm font-bold text-white">K</span>
            <div>
              <p className="text-sm font-semibold">Keys Inc.</p>
              <p className="text-xs text-[#6b7a74]">Attendance administration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="min-h-10 border border-[#cbd6d0] px-4 text-sm font-medium transition hover:bg-[#f4f7f5]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-11">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#55766a]">Operations</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Class sessions</h1>
            <p className="mt-2 text-sm text-[#64756e]">Timetable and session times use Africa/Accra.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-5 border-l-2 border-[#b63f36] bg-[#fff5f3] px-4 py-3 text-sm text-[#8f3029]">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className={`mb-5 border-l-2 px-4 py-3 text-sm ${
              notice.type === "success"
                ? "border-[#25815d] bg-[#eef7f1] text-[#23724f]"
                : "border-[#c28a20] bg-[#fff8e8] text-[#77520e]"
            }`}
          >
            {notice.text}
          </p>
        )}

        <section className="mb-9">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Today&apos;s classes</h2>
              <p className="mt-1 text-sm text-[#718078]">
                {data?.todayDayOfWeek ? weekdays[data.todayDayOfWeek] : ""} in Ghana time
              </p>
            </div>
            <span className="text-sm text-[#718078]">{todayCourses.length} courses</span>
          </div>
          <div className="overflow-hidden border border-[#d6dfda]">
            {loading ? (
              <p className="bg-white px-5 py-6 text-sm text-[#6b7a74]">Loading timetable...</p>
            ) : todayCourses.length ? (
              todayCourses.map(renderCourse)
            ) : (
              <p className="bg-white px-5 py-6 text-sm text-[#6b7a74]">No classes are scheduled today.</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Other courses</h2>
              <p className="mt-1 text-sm text-[#718078]">Open a session manually for any course.</p>
            </div>
            <span className="text-sm text-[#718078]">{otherCourses.length} courses</span>
          </div>
          <div className="overflow-hidden border border-[#d6dfda]">
            {loading ? (
              <p className="bg-white px-5 py-6 text-sm text-[#6b7a74]">Loading courses...</p>
            ) : otherCourses.length ? (
              otherCourses.map(renderCourse)
            ) : (
              <p className="bg-white px-5 py-6 text-sm text-[#6b7a74]">All courses are on today&apos;s timetable.</p>
            )}
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Past sessions</h2>
              <p className="mt-1 text-sm text-[#718078]">Closed classes and lecturer report delivery.</p>
            </div>
            <span className="text-sm text-[#718078]">Last 50</span>
          </div>
          <div className="overflow-hidden border border-[#d6dfda] bg-white">
            {loading ? (
              <p className="px-5 py-6 text-sm text-[#6b7a74]">Loading past sessions...</p>
            ) : data?.pastSessions?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[#e3e9e5] bg-[#f8faf8] text-xs uppercase tracking-wide text-[#718078]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Course</th>
                      <th className="px-5 py-3 font-medium">Closed</th>
                      <th className="px-5 py-3 font-medium">Attendance</th>
                      <th className="px-5 py-3 font-medium">Report</th>
                      <th className="px-5 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pastSessions.map((session) => (
                      <tr key={session.id} className="border-b border-[#edf1ee] last:border-0">
                        <td className="px-5 py-4">
                          <span className="font-semibold">{session.courseCode}</span>
                          <span className="ml-2 text-[#65756e]">{session.courseName}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-[#65756e]">
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Africa/Accra",
                          }).format(new Date(session.closedAt))}
                        </td>
                        <td className="px-5 py-4">{session.attendanceCount}</td>
                        <td className="px-5 py-4">
                          {session.pdfEmailedAt ? (
                            <span className="font-medium text-[#23724f]">Emailed</span>
                          ) : (
                            <span className="text-[#a36b12]">Not emailed</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {!session.pdfEmailedAt && (
                            <button
                              type="button"
                              disabled={Boolean(workingCourse)}
                              onClick={() => resendReport(session)}
                              className="min-h-9 border border-[#bdcbc4] px-3 text-sm font-medium text-[#245c4b] transition hover:bg-[#f4f7f5] disabled:opacity-60"
                            >
                              {workingCourse === `resend-${session.id}` ? "Sending..." : "Resend PDF"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-[#6b7a74]">No past sessions yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}