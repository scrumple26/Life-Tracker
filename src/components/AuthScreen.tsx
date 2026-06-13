"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/data";
import { BrandMark } from "./Brand";

type Mode = "signin" | "register";

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account already exists for that email.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email.";
    case "auth/weak-password":
      return "Password is too weak — try something longer.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return (err as { message?: string })?.message ?? "Something went wrong.";
  }
}

export function AuthScreen() {
  const { signIn, register, resetPassword } = useApp();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const reqs = useMemo(
    () => ({
      len: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      num: /[0-9]/.test(password),
    }),
    [password]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        if (password !== confirm) throw new Error("Passwords don't match.");
        if (!reqs.len || !reqs.upper || !reqs.lower || !reqs.num)
          throw new Error("Please meet all the password requirements.");
        await register(email.trim(), password);
      }
    } catch (err) {
      setMsg({ text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setMsg({ text: "Enter your email above first, then tap “Forgot password”." });
      return;
    }
    setMsg(null);
    try {
      await resetPassword(email.trim());
      setMsg({ text: "Password reset email sent — check your inbox.", ok: true });
    } catch (err) {
      setMsg({ text: authErrorMessage(err) });
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-5">
      <div className="card lf-rise w-full max-w-md p-7 sm:p-9">
        <div className="flex flex-col items-center text-center gap-3 mb-7">
          <div className="rounded-3xl shadow-[var(--shadow-soft)]">
            <BrandMark size={56} />
          </div>
          <div>
            <h1 className="text-3xl text-ink">lifelong</h1>
            <p className="text-sm text-muted mt-1">
              Keep the games, trips, meals & shows you&apos;ve lived.
            </p>
          </div>
        </div>

        <div className="flex p-1 rounded-full bg-paper-2 mb-6">
          {(["signin", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setMsg(null);
              }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
                mode === m
                  ? "bg-card text-ink shadow-[var(--shadow-soft)]"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === "register" && (
            <>
              <div className="flex flex-wrap gap-1.5 -mt-1">
                {[
                  ["8+ characters", reqs.len],
                  ["Uppercase", reqs.upper],
                  ["Lowercase", reqs.lower],
                  ["Number", reqs.num],
                ].map(([label, ok]) => (
                  <span
                    key={label as string}
                    className={`text-xs px-2 py-0.5 rounded-full transition ${
                      ok
                        ? "bg-sage-soft text-sage"
                        : "bg-paper-2 text-muted"
                    }`}
                  >
                    {ok ? "✓ " : ""}
                    {label}
                  </span>
                ))}
              </div>
              <div>
                <label className="field-label" htmlFor="confirm">
                  Confirm Password
                </label>
                <input
                  id="confirm"
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="field"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-sm text-ink-soft select-none">
            <input
              type="checkbox"
              checked={showPwd}
              onChange={(e) => setShowPwd(e.target.checked)}
              className="accent-[var(--color-terracotta)]"
            />
            Show password{mode === "register" ? "s" : ""}
          </label>

          {mode === "signin" && (
            <button
              type="button"
              onClick={forgot}
              className="text-sm text-terracotta hover:text-terracotta-dark self-start -mt-1"
            >
              Forgot password?
            </button>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "One moment…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {msg && (
          <p
            className={`text-sm text-center mt-4 ${
              msg.ok ? "text-sage" : "text-clay"
            }`}
            aria-live="polite"
          >
            {msg.text}
          </p>
        )}
      </div>
    </main>
  );
}
