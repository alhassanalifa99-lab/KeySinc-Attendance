"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Sign in failed.");
        return;
      }

      const destination = new URLSearchParams(window.location.search).get("next");
      window.location.assign(destination?.startsWith("/admin") ? destination : "/admin");
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f4] px-5 py-12 text-[#172b27]">
      <section className="w-full max-w-md border border-[#d6dfda] bg-white px-8 py-10 shadow-[0_18px_60px_rgba(23,43,39,0.08)] sm:px-10">
        <div className="mb-9 border-b border-[#e5ebe7] pb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#55766a]">
            Keys Inc. Attendance
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-2 text-sm text-[#64756e]">Enter the administrator password to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}