"use client";

import { use, useState } from "react";

function formatSignedAt(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export default function StudentSignInPage({ params }) {
  const { sessionId } = use(params);
  const [indexNumber, setIndexNumber] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function getDeviceFingerprint() {
    if (deviceFingerprint) return deviceFingerprint;

    let fingerprint = "";
    try {
      fingerprint = window.localStorage.getItem("keysinc_device_fingerprint") ?? "";
      if (!fingerprint) {
        fingerprint = window.crypto.randomUUID();
        window.localStorage.setItem("keysinc_device_fingerprint", fingerprint);
      }
    } catch {
      fingerprint = window.crypto.randomUUID();
    }

    setDeviceFingerprint(fingerprint);
    return fingerprint;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/attendance/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          indexNumber,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.ok) {
        setError(body.message ?? "Sign-in could not be completed.");
        return;
      }

      setResult(body);
    } catch {
      setError("Unable to reach the attendance service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f4] px-5 py-10 text-[#172b27]">
      <section className="w-full max-w-lg border border-[#d6dfda] bg-white px-7 py-9 shadow-[0_18px_60px_rgba(23,43,39,0.08)] sm:px-10">
        <header className="mb-8 border-b border-[#e5ebe7] pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#55766a]">Keys Inc. Attendance</p>
          <h1 className="text-3xl font-semibold tracking-tight">Class sign-in</h1>
          <p className="mt-2 text-sm text-[#64756e]">Enter your student index number to record attendance.</p>
        </header>

        {result ? (
          <div role="status" className="border-l-2 border-[#25815d] bg-[#eef7f1] px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#23724f]">Attendance recorded</p>
            <h2 className="mt-2 text-xl font-semibold">{result.fullName}</h2>
            <p className="mt-1 text-sm text-[#41574e]">{result.courseName}</p>
            <p className="mt-4 text-sm text-[#65756e]">{result.indexNumber}</p>
            <p className="mt-1 text-sm text-[#65756e]">{formatSignedAt(result.signedAt)}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="index-number" className="mb-2 block text-sm font-medium">Student index number</label>
              <input
                id="index-number"
                name="indexNumber"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                required
                minLength={3}
                maxLength={32}
                value={indexNumber}
                onChange={(event) => setIndexNumber(event.target.value)}
                className="h-12 w-full border border-[#bdcbc4] bg-white px-3 text-base outline-none transition focus:border-[#245c4b] focus:ring-2 focus:ring-[#245c4b]/20"
              />
            </div>

            {error && (
              <p role="alert" className="border-l-2 border-[#b63f36] bg-[#fff5f3] px-3 py-2 text-sm text-[#8f3029]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center bg-[#245c4b] px-4 text-sm font-semibold text-white transition hover:bg-[#194938] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Sign in to class"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}