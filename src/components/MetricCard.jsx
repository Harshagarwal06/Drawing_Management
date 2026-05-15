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
    <div className={`metric-card bg-white rounded-xl border ${a.ring} p-5 flex items-start gap-4`}>
      <div className={`${a.icon} rounded-lg p-2.5 text-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-3xl font-bold ${a.val}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
