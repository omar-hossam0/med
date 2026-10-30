"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { activateAccount, ApiError } from "@/lib/api/admin";

/**
 * Destination for the one-time activation link issued when an administrator
 * provisions a doctor or staff account. The token is read from the query string
 * and consumed once by POST /api/auth/activate.
 */
export default function ActivatePage() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
    setReady(true);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting) return;

    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await activateAccount(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not set your password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F8F8] px-4 py-10">
      <div className="w-full max-w-[430px] rounded-2xl border border-[#E5ECEC] bg-white p-6 shadow-soft">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A9189]">
          Medora
        </p>

        {!ready ? (
          <p className="mt-3 text-[12px] text-[#7A8B9C]">Checking your link…</p>
        ) : done ? (
          <>
            <h1 className="mt-2 text-[19px] font-bold text-[#0F2D4A]">Password set</h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5B6B7C]">
              Your account is ready. Sign in with your email address and the password you
              just chose.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#0A9189] text-[12px] font-semibold text-white transition hover:bg-[#087F78]"
            >
              Go to sign in
            </Link>
          </>
        ) : !token ? (
          <>
            <h1 className="mt-2 text-[19px] font-bold text-[#0F2D4A]">Link not valid</h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5B6B7C]">
              This address is missing its activation token. Ask the clinic administrator to
              send a new invitation.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex text-[12px] font-semibold text-[#0A9189] hover:underline"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-[19px] font-bold text-[#0F2D4A]">Set your password</h1>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5B6B7C]">
              Choose a password with at least 8 characters, one uppercase letter, one
              lowercase letter and one number.
            </p>

            <form className="mt-4 space-y-3" onSubmit={submit}>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-[11px] font-medium text-[#0F2D4A]"
                >
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E5ECEC] px-3 text-[12.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmation"
                  className="mb-1 block text-[11px] font-medium text-[#0F2D4A]"
                >
                  Confirm password
                </label>
                <input
                  id="confirmation"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E5ECEC] px-3 text-[12.5px] text-[#0F2D4A] outline-none transition focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-[#E5484D]/30 bg-[#FDECEF] px-3 py-2 text-[11px] leading-relaxed text-[#B42318]"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#0A9189] text-[12px] font-semibold text-white transition hover:bg-[#087F78] disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Set password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
