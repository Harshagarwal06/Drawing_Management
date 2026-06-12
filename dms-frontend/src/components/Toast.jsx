import { useEffect, useEffectEvent } from "react";
import { Check, AlertTriangle } from "lucide-react";

export default function Toast({ msg, type = "success", onDone }) {
  const handleDone = useEffectEvent(() => onDone());
  useEffect(() => {
    const t = setTimeout(() => handleDone(), 4000);
    return () => clearTimeout(t);
  }, []);

  const isError = type === "error";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 modal-enter px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium text-white ${
        isError ? "bg-red-600" : "bg-emerald-600"
      }`}
    >
      {isError
        ? <AlertTriangle className="w-5 h-5 shrink-0" />
        : <Check className="w-5 h-5 shrink-0" />}
      {msg}
    </div>
  );
}
