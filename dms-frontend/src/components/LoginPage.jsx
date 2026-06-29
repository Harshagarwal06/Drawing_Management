import { useState } from "react";
import { Loader2, Eye, EyeOff, ShieldCheck, FileStack, Send, ArrowRight, Lock, User, Users } from "lucide-react";

const FEATURES = [
  {
    Icon: FileStack,
    title: "Master Drawing Register",
    desc:  "Centralised repository for drawings, revisions, and full document status tracking across every discipline.",
  },
  {
    Icon: Users,
    title: "Role-Based Access Control",
    desc:  "Director, In House Architect, and Project Team roles with per-project permissions and controlled visibility.",
  },
  {
    Icon: Send,
    title: "Transmittal & Revision Tracking",
    desc:  "Issue transmittals, track approvals, and manage the complete document lifecycle from S1 through construction.",
  },
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const data = await res.json();
        setError(data.error || "Invalid credentials. Please try again.");
      }
    } catch {
      setError("Cannot connect to server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ═══════════════════════ LEFT PANEL ═══════════════════════ */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "linear-gradient(145deg, #0a0f1e 0%, #111827 35%, #1a1060 70%, #1B3A6B 100%)" }}
      >
        {/* Blueprint grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99,102,241,0.10) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99,102,241,0.10) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Axis cross-hairs at intersections (decorative) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(139,92,246,0.25) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Soft glow blobs */}
        <div className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full bg-primary/20 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 -left-16 w-72 h-72 rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />

        {/* Logo + wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="Unique Properties" className="h-10 w-auto object-contain drop-shadow-lg" />
          <div>
            <p
              className="font-bold text-[17px] leading-tight"
              style={{
                background: "linear-gradient(90deg, #F4A223 0%, #C9A06A 45%, #93c5fd 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Unique Properties
            </p>
            <p className="text-slate-500 text-[11px] tracking-wide">Enterprise Management</p>
          </div>
        </div>

        {/* Headline + features */}
        <div className="relative z-10 space-y-8 my-auto">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/15 backdrop-blur-sm w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-medium text-white/75 tracking-wide">Enterprise Drawing Management</span>
          </div>

          {/* Hero headline */}
          <div className="space-y-3">
            <h1 className="text-[40px] font-extrabold text-white leading-[1.15] tracking-tight">
              Every drawing.<br />
              Every revision.<br />
              <span
                style={{
                  background: "linear-gradient(90deg, #F4A223 0%, #93c5fd 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Under control.
              </span>
            </h1>
            <p className="text-slate-400 text-[14px] leading-relaxed max-w-[380px]">
              Manage drawings, revisions, approvals, and transmittals for your construction projects — in one secure, role-based workspace.
            </p>
          </div>

          {/* Feature rows */}
          <div className="space-y-2.5">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3.5 p-4 rounded-xl border border-white/10 backdrop-blur-sm"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/25 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-blue-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-[13px] font-semibold leading-tight">{title}</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom security line */}
        <div className="relative z-10 flex items-center gap-2">
          <ShieldCheck size={13} className="text-slate-600 shrink-0" />
          <p className="text-slate-600 text-[11px]">
            JWT authentication · Role-based access control · SSL encrypted
          </p>
        </div>
      </div>

      {/* ═══════════════════════ RIGHT PANEL ══════════════════════ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10 lg:p-12 bg-background">
        <div className="w-full max-w-[360px]">

          {/* Mobile-only logo (left panel hidden on mobile) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src="/logo.png" alt="Unique Properties" className="h-20 w-auto object-contain mb-4" />
            <h1
              className="font-bold text-[18px]"
              style={{
                background: "linear-gradient(90deg, #F4A223 0%, #C9A06A 50%, #1B6ABF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Unique Properties
            </h1>
            <p className="text-[12px] text-on-surface-variant mt-1">Enterprise Drawing Management</p>
          </div>

          {/* ── Login card ── */}
          <div className="bg-surface rounded-2xl border border-outline-variant shadow-card-lg overflow-hidden">

            {/* Top gradient accent */}
            <div className="h-[3px] bg-gradient-to-r from-[#F4A223] via-primary to-indigo-500" />

            <div className="p-8">

              {/* Desktop card header */}
              <div className="hidden lg:flex flex-col items-center mb-7">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <img src="/logo.png" alt="" className="h-7 w-auto object-contain" />
                </div>
                <h2 className="text-[16px] font-bold text-on-surface">Secure Project Workspace</h2>
                <p className="text-[12px] text-on-surface-variant mt-0.5">Sign in to access your projects</p>
              </div>

              {/* Mobile card header */}
              <div className="lg:hidden mb-6">
                <h2 className="text-[20px] font-bold text-on-surface">Sign in</h2>
                <p className="text-[13px] text-on-surface-variant mt-0.5">Secure Project Workspace</p>
              </div>

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Error banner */}
                {error && (
                  <div className="bg-status-rose-bg border border-status-rose-text/20 text-status-rose-text text-[12px] font-medium p-3 rounded-xl text-center">
                    {error}
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className="block text-[12px] font-semibold text-on-surface-variant mb-1.5">
                    Username
                  </label>
                  <div className="relative group">
                    <User
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors pointer-events-none"
                    />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="username"
                      autoComplete="username"
                      className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-9 pr-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-semibold text-on-surface-variant">Password</label>
                  </div>
                  <div className="relative group">
                    <Lock
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors pointer-events-none"
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full bg-surface-container-low border border-outline-variant rounded-xl pl-9 pr-10 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-0.5 rounded"
                      tabIndex={-1}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1 bg-primary text-white font-semibold text-[14px] py-3 rounded-xl hover:bg-primary-container transition-all duration-200 shadow-card flex justify-center items-center gap-2 disabled:opacity-60 active:scale-[0.98]"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Authenticating…</>
                  ) : (
                    <>Enter Workspace<ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              {/* Security line */}
              <div className="flex items-center justify-center gap-1.5 mt-5 pt-5 border-t border-outline-variant">
                <ShieldCheck size={12} className="text-on-surface-variant shrink-0" />
                <p className="text-[11px] text-on-surface-variant text-center leading-tight">
                  Secured with JWT authentication · Role-based access control
                </p>
              </div>
            </div>
          </div>

          {/* Bottom note */}
          <p className="text-center text-[11px] text-on-surface-variant mt-4">
            Enterprise instance · Unique Properties v2.2
          </p>
        </div>
      </div>

    </div>
  );
}
