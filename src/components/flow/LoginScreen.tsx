import { useState, useRef } from "react";
import { tabroomLogin } from "@/lib/tabroom-api";
import type { FlowUser } from "@/types/flow";

interface LoginScreenProps {
  onLoginSuccess: (user: FlowUser) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);
  const [shakeEmail, setShakeEmail] = useState(false);
  const [shakePass, setShakePass] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      if (!email) {
        setShakeEmail(true);
        setTimeout(() => setShakeEmail(false), 400);
      }
      if (!password) {
        setShakePass(true);
        setTimeout(() => setShakePass(false), 400);
      }
      return;
    }

    setLoading(true);

    try {
      const result = await tabroomLogin(email, password);

      if (result.success && result.token) {
        const user: FlowUser = {
          email,
          name: result.name || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          token: result.token,
          person_id: result.person_id,
        };

        if (remember) {
          localStorage.setItem("flow_user", JSON.stringify(user));
        }

        onLoginSuccess(user);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setShakePass(true);
      setTimeout(() => setShakePass(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-flow-login-bg flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 20% 30%, rgba(42,92,69,.25) 0%, transparent 70%),
              radial-gradient(ellipse 40% 60% at 80% 70%, rgba(176,125,42,.12) 0%, transparent 60%),
              radial-gradient(ellipse 30% 40% at 60% 20%, rgba(42,92,69,.1) 0%, transparent 60%)
            `,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[400px] mx-4 animate-loginrise">
        <div
          className="rounded-[20px] p-10 pb-9"
          style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 32px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          {/* Logo */}
          <h1 className="font-serif text-[38px] font-extralight tracking-[-2px] text-white italic mb-1">
            Fl<span className="text-flow-green-bright not-italic">o</span>w
          </h1>
          <p className="text-[11.5px] text-white/40 tracking-wide mb-8">
            Debate tournament assistant · Powered by Tabroom
          </p>

          {/* Error */}
          {error && (
            <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5 animate-fadein"
              style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
              {error}
            </div>
          )}

          {/* Email */}
          <div className="mb-3.5">
            <label className="block text-[10px] uppercase tracking-[1.2px] text-white/40 mb-1.5">
              Tabroom Email
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className={`w-full rounded-lg px-3.5 py-[11px] font-mono text-[13px] text-white outline-none transition-all ${shakeEmail ? "animate-shake" : ""}`}
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(74,222,128,.5)", e.target.style.background = "rgba(255,255,255,.08)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.1)", e.target.style.background = "rgba(255,255,255,.06)")}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="mb-3.5">
            <label className="block text-[10px] uppercase tracking-[1.2px] text-white/40 mb-1.5">
              Password
            </label>
            <input
              ref={passRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full rounded-lg px-3.5 py-[11px] font-mono text-[13px] text-white outline-none transition-all ${shakePass ? "animate-shake" : ""}`}
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(74,222,128,.5)", e.target.style.background = "rgba(255,255,255,.08)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,.1)", e.target.style.background = "rgba(255,255,255,.06)")}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoComplete="current-password"
            />
          </div>

          {/* Remember */}
          <label className="flex items-center gap-2 mb-5 text-[11.5px] text-white/40 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-flow-green-bright cursor-pointer"
            />
            Remember me on this device
          </label>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-mono text-[13px] font-medium tracking-wide flex items-center justify-center gap-2 transition-all hover:brightness-90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Sign in to Tabroom"
            )}
          </button>

          {/* Security */}
          <div className="flex flex-col gap-1.5 mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div className="flex items-center gap-2 text-[11px] text-white/30">
              <span className="text-flow-green-bright/60">🔒</span> Credentials sent only to tabroom.com via secure proxy
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/30">
              <span className="text-flow-green-bright/60">💾</span> Saved locally — never uploaded anywhere
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/30">
              <span className="text-flow-green-bright/60">🔑</span> Session expires when Tabroom session ends
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 text-center text-[11px] text-white/25 leading-relaxed">
            No account?{" "}
            <a
              href="https://tabroom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 underline"
            >
              Register on tabroom.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
