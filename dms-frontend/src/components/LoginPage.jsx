import { useState } from "react";
import { Loader2, Eye, EyeOff, ShieldCheck, FileStack, Send, Lock, User, Users } from "lucide-react";

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
    <main className="min-h-[100dvh] grid lg:grid-cols-[minmax(24rem,0.9fr)_minmax(28rem,1.1fr)] bg-background">
      <section className="hidden lg:flex flex-col justify-between bg-on-surface text-surface p-12" aria-labelledby="drawvault-context-title">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Unique Properties" className="h-11 w-11 rounded-lg object-contain bg-surface" />
          <div>
            <p className="font-display-lg text-[18px] font-bold">DrawVault</p>
            <p className="text-[12px] text-surface/65">Unique Properties</p>
          </div>
        </div>

        <div className="max-w-[34rem]">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-primary-fixed-dim">Project drawing workspace</p>
          <h1 id="drawvault-context-title" className="mt-4 font-display-lg text-[40px] leading-[1.08] font-bold tracking-[-0.04em]">Find the current drawing. Check the revision. Issue the record.</h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-7 text-surface/70">DrawVault keeps project drawings, revisions, approvals, and transmittals in one role-controlled workspace.</p>

          <div className="mt-10 divide-y divide-surface/15 border-y border-surface/15">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="flex gap-4 py-4">
                <Icon size={18} className="mt-0.5 shrink-0 text-primary-fixed-dim" />
                <div>
                  <p className="text-[14px] font-semibold">{title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-surface/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-surface/55">
          <ShieldCheck size={15} />
          <span>Authenticated access · Project-level permissions</span>
        </div>
      </section>

      <section className="safe-top safe-bottom flex items-center justify-center px-4 py-8 sm:px-8 lg:p-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/logo.png" alt="Unique Properties" className="h-11 w-11 rounded-lg object-contain bg-surface border border-border-slate" />
            <div>
              <p className="workspace-heading text-[20px]">DrawVault</p>
              <p className="text-[13px] text-on-surface-variant">Unique Properties</p>
            </div>
          </div>

          <div className="workspace-panel p-5 sm:p-8">
            <h2 className="workspace-heading text-[26px]">Sign in</h2>
            <p className="mt-2 text-[14px] leading-6 text-on-surface-variant">Use your assigned DrawVault account to open project documents.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error && (
                <div className="flex gap-2 rounded-lg border border-status-rose-text/25 bg-status-rose-bg p-3 text-[13px] leading-5 text-status-rose-text" role="alert">
                  <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">error</span>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="login-username" className="block text-[13px] font-semibold text-on-surface mb-2">Username</label>
                <div className="relative">
                  <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                  <input id="login-username" type="text" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required className="w-full min-h-12 rounded-md border border-border-slate bg-surface px-4 pl-11 text-[16px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-[13px] font-semibold text-on-surface mb-2">Password</label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                  <input id="login-password" type={showPw ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className="w-full min-h-12 rounded-md border border-border-slate bg-surface px-12 pl-11 text-[16px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <button type="button" onClick={() => setShowPw(value => !value)} className="absolute right-0 top-1/2 -translate-y-1/2 mobile-touch-target grid place-items-center text-on-surface-variant" aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full min-h-12 rounded-md bg-primary px-4 text-[15px] font-semibold text-on-primary disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</> : "Sign in to DrawVault"}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-2 border-t border-border-slate pt-5 text-[12px] leading-5 text-on-surface-variant">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <p>Your role and assigned projects control what you can view or change.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
