import { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
        if (data.user && !data.session) {
          setConfirmEmail(true);
        }
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(friendlyError(err));
  }

  if (confirmEmail) {
    return (
      <div className="auth-splash">
        <div className="auth-card">
          <h1 className="auth-wordmark">StudyBot</h1>
          <p className="auth-confirm-msg">
            Check your email to confirm your account, then come back and log in.
          </p>
          <button
            className="auth-btn auth-btn-primary"
            onClick={() => {
              setConfirmEmail(false);
              setMode("login");
            }}
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-splash">
      <div className="auth-card">
        <h1 className="auth-wordmark">StudyBot</h1>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(null); }}
          >
            Log in
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => { setMode("signup"); setError(null); }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            className="auth-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="auth-label" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            className="auth-input"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="banner error auth-error">{error}</p>}

          <button
            type="submit"
            className="auth-btn auth-btn-primary"
            disabled={loading}
          >
            {loading
              ? mode === "login" ? "Signing in…" : "Creating account…"
              : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="auth-btn auth-btn-google" onClick={handleGoogle}>
          <svg className="auth-google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function friendlyError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("Invalid login credentials")) return "Invalid email or password.";
  if (msg.includes("User already registered")) return "An account with this email already exists.";
  if (msg.includes("Email not confirmed")) return "Please confirm your email before logging in.";
  if (msg.includes("Password should be at least")) return "Password must be at least 6 characters.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Too many attempts — please wait a moment.";
  if (msg.includes("Unable to validate email")) return "Please enter a valid email address.";
  return msg;
}
