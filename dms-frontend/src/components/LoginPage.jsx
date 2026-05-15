import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = (role) => {
    switch(role) {
      case 'Admin': setUsername('admin'); setPassword('admin123'); break;
      case 'PM': setUsername('pm'); setPassword('pm123'); break;
      case 'Sub': setUsername('sub'); setPassword('sub123'); break;
      case 'Viewer': setUsername('viewer'); setPassword('viewer123'); break;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative flex items-center justify-center bg-background text-on-background font-body-md text-body-md selection:bg-primary/30 selection:text-primary">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-tertiary/5 blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-background/80"></div>
      </div>
      <div className="z-10 w-full max-w-md px-6">
        <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
              <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">DrawVault</h1>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Secure Project Workspace</p>
          </div>
          
          <div className="mb-8 p-1 bg-surface-container-lowest/50 border border-white/5 rounded-lg flex gap-1 relative z-20">
            {['Admin', 'PM', 'Sub', 'Viewer'].map((role) => (
              <button 
                key={role}
                onClick={() => handleDemoClick(role)}
                className={`flex-1 py-2 text-center rounded-md font-label-sm text-label-sm transition-all ${
                  (role === 'Admin' && username === 'admin') || 
                  (role === 'PM' && username === 'pm') || 
                  (role === 'Sub' && username === 'sub') || 
                  (role === 'Viewer' && username === 'viewer')
                  ? "bg-surface-container-highest shadow-sm border border-white/10 text-on-surface" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                }`}
                type="button"
              >
                {role}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-error-container/20 border border-error/30 text-error text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-2">Username</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px] group-focus-within:text-primary transition-colors">person</span>
                <input 
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-surface-container-lowest/50 border border-outline-variant/30 rounded-lg pl-10 pr-4 py-3 font-body-sm text-body-sm text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface-container-lowest transition-all" 
                  placeholder="admin" 
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-sm text-label-sm text-on-surface-variant">Password</label>
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[18px] group-focus-within:text-primary transition-colors">lock</span>
                <input 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest/50 border border-outline-variant/30 rounded-lg pl-10 pr-4 py-3 font-body-sm text-body-sm text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-surface-container-lowest transition-all" 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-primary text-on-primary font-label-md text-label-md py-3.5 rounded-lg hover:bg-primary-fixed transition-all duration-200 shadow-[0_0_20px_-5px_rgba(195,192,255,0.4)] hover:shadow-[0_0_25px_-5px_rgba(195,192,255,0.6)] flex justify-center items-center gap-2 relative overflow-hidden group disabled:opacity-70 disabled:hover:translate-x-0"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating</>
              ) : (
                <>
                  <span className="relative z-10">Authenticate</span>
                  <span className="material-symbols-outlined text-[16px] relative z-10 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                </>
              )}
            </button>
          </form>
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Enterprise instance. <a className="text-primary hover:text-primary-fixed hover:underline transition-colors" href="#">System Status</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
