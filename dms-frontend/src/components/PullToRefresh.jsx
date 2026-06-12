import { useRef, useState } from "react";

const THRESHOLD = 70;  // damped px needed to trigger a refresh
const MAX_PULL  = 110;

/* Touch-only pull-to-refresh around the routed page content. Mouse users
   never fire touch events, so desktop behaviour is unchanged. */
export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull]             = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  const atTop = () => (document.scrollingElement?.scrollTop ?? 0) <= 0;

  /* Pulls that start inside an inner scrolled element (drawers, panels)
     are scroll gestures for that element, not for the page. */
  const insideScrolledElement = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollTop > 0) return true;
    }
    return false;
  };

  const onTouchStart = (e) => {
    if (refreshing || !atTop() || insideScrolledElement(e.target)) return;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0 || !atTop()) { setPull(0); return; }
    setPull(Math.min(dy * 0.45, MAX_PULL));
  };

  const onTouchEnd = async () => {
    const triggered = pull >= THRESHOLD;
    startY.current = null;
    if (!triggered) { setPull(0); return; }
    setRefreshing(true);
    setPull(THRESHOLD);
    try { await onRefresh?.(); }
    finally { setRefreshing(false); setPull(0); }
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="relative">
      <div
        className="md:hidden absolute left-1/2 z-30 pointer-events-none"
        style={{
          top: -44,
          transform: `translate(-50%, ${pull}px)`,
          opacity: pull > 8 || refreshing ? 1 : 0,
          transition: refreshing || pull === 0 ? "transform 200ms ease, opacity 200ms ease" : "none",
        }}
      >
        <div className="w-9 h-9 rounded-full bg-surface shadow-md border border-border-slate flex items-center justify-center">
          <span
            className={`material-symbols-outlined text-[20px] text-primary ${refreshing ? "animate-spin" : ""}`}
            style={!refreshing ? { transform: `rotate(${pull * 2.5}deg)` } : undefined}
          >
            refresh
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
