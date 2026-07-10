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
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.95fr)] bg-background">
      <aside className="login-context hidden lg:flex flex-col min-h-screen px-12 py-10 xl:px-16">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Unique Properties" className="h-10 w-auto object-contain bg-white rounded-sm p-1" />
          <div>
            <p className="font-space-grotesk text-[17px] font-semibold tracking-tight">Unique Properties</p>
            <p className="login-context-mark mt-1">Document control workspace</p>
          </div>
        </div>

        <div className="my-auto max-w-xl">
          <p className="login-context-mark mb-5">One source of record</p>
          <h1 className="font-space-grotesk text-[clamp(2.6rem,4vw,4.6rem)] font-semibold tracking-[-0.045em] leading-[0.98]">Drawings, clear and controlled.</h1>
          <p className="login-context-copy mt-6 max-w-lg text-[15px] leading-7">A focused workspace for issuing, reviewing, and locating the latest project documentation without losing the history behind it.</p>

          <div className="mt-10 border-y login-context-rule divide-y login-context-rule">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-4 py-5">
                <Icon size={18} className="login-context-icon mt-0.5" />
                <div>
                  <p className="text-[14px] font-semibold text-on-primary">{title}</p>
                  <p className="login-context-copy mt-1 text-[12px] leading-5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="login-context-copy flex items-center gap-2 pt-8">
          <ShieldCheck size={14} className="shrink-0" />
          <p className="text-[11px]">Authenticated access with role-based project visibility.</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-14 xl:px-20">
        <div className="w-full max-w-[25rem]">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img src="/logo.png" alt="Unique Properties" className="h-12 w-auto object-contain" />
            <div>
              <p className="font-space-grotesk font-semibold text-on-surface">Unique Properties</p>
              <p className="workspace-eyebrow mt-1">Document control workspace</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="workspace-eyebrow">Secure access</p>
            <h2 className="workspace-heading mt-3 text-[clamp(2rem,3vw,2.65rem)] leading-none">Sign in to your workspace</h2>
            <p className="mt-3 text-[14px] leading-6 text-on-surface-variant">Use your assigned account to continue to your project documents.</p>
          </div>

          <div className="workspace-panel rounded-xl p-5 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-5">

                {/* Error banner */}
                {error && (
                  <div className="bg-status-rose-bg border border-status-rose-text/20 text-status-rose-text text-[12px] font-medium p-3 rounded-md text-center">
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
                      className="login-input w-full h-11 bg-surface-container-low border border-outline-variant rounded-md pl-9 pr-4 text-[14px] text-on-surface placeholder:text-on-surface-variant outline-none transition-[border-color,box-shadow]"
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
                      className="login-input w-full h-11 bg-surface-container-low border border-outline-variant rounded-md pl-9 pr-10 text-[14px] text-on-surface placeholder:text-on-surface-variant outline-none transition-[border-color,box-shadow]"
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
                  className="w-full mt-1 h-11 bg-primary text-on-primary font-semibold text-[14px] rounded-md hover:bg-primary-container transition-colors duration-200 flex justify-center items-center gap-2 disabled:opacity-60 active:translate-y-px"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Authenticating…</>
                  ) : (
                    <>Enter Workspace<ArrowRight size={15} /></>
                  )}
                </button>
            </form>
          </div>

          <p className="mt-5 text-[11px] leading-5 text-on-surface-variant">
            Access is role-aware and scoped to the projects assigned to your account.
          </p>
        </div>
      </main>
    </div>
  );
}
