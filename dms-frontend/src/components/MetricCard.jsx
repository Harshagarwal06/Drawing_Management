const ACCENTS = {
  blue:    { ring: "border-blue-200",    icon: "bg-blue-50 text-blue-600",       val: "text-blue-700"    },
  amber:   { ring: "border-amber-200",   icon: "bg-amber-50 text-amber-600",     val: "text-amber-700"   },
  red:     { ring: "border-red-200",     icon: "bg-red-50 text-red-600",         val: "text-red-700"     },
  emerald: { ring: "border-emerald-200", icon: "bg-emerald-50 text-emerald-600", val: "text-emerald-700" },
  violet:  { ring: "border-violet-200",  icon: "bg-violet-50 text-violet-600",   val: "text-violet-700"  },
};

export default function MetricCard({ label, value, sub, icon, accent }) {
  const a = ACCENTS[accent] ?? ACCENTS.blue;
  return (
    <div className={`metric-card bg-white/70 backdrop-blur-xl rounded-2xl border ${a.ring} p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-white`}>
      <div className={`${a.icon} rounded-xl p-3 text-xl shrink-0 shadow-sm`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-3xl font-black tracking-tight ${a.val}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1.5 font-medium">{sub}</p>}
      </div>
    </div>
  );
}
