import { useState } from "react";
import { Loader2 } from "lucide-react";

const DEMO_USERS = [
  { label: "Admin",  username: "admin",  password: "admin123" },
  { label: "PM",     username: "pm",     password: "pm123"    },
  { label: "Sub",    username: "sub",    password: "sub123"   },
  { label: "Viewer", username: "viewer", password: "viewer123"},
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [activeDemo, setActiveDemo] = useState("Admin");

  const handleDemoClick = (demo) => {
    setActiveDemo(demo.label);
    setUsername(demo.username);
    setPassword(demo.password);
  };

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
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-tertiary/5 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#3525cd08 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Card */}
        <div className="bg-surface rounded-2xl border border-outline-variant shadow-card-lg overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary-container to-primary/60" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <img src="/logo.png" alt="Unique Properties" className="h-10 w-auto object-contain mb-4" />
              <h1
                className="font-headline-sm text-headline-sm font-semibold text-center"
                style={{ background: "linear-gradient(90deg, #F4A223 0%, #C9A06A 50%, #1B6ABF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
              >
                Unique Properties
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center mt-1">Secure Project Workspace</p>
            </div>

            {/* Access level tabs */}
            <div className="mb-6 p-1 bg-surface-container rounded-xl flex gap-1">
              {DEMO_USERS.map(demo => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => handleDemoClick(demo)}
                  className={`flex-1 py-1.5 text-center rounded-lg font-label-sm text-label-sm transition-all duration-150 ${
                    activeDemo === demo.label
                      ? "bg-surface shadow-card text-primary font-semibold border border-outline-variant"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {demo.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-error-container border border-error/30 text-on-error-container text-sm p-3 rounded-lg text-center font-body-sm">
                  {error}
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">Username</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] group-focus-within:text-primary transition-colors">person</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">Password</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container transition-all duration-200 shadow-card flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating…</>
                ) : (
                  <>
                    Enter Workspace
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
              Enterprise instance · Unique Properties v2.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
