import { useEffect, useRef } from "react";

export default function useModalClose(onClose) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleBackdrop = e => {
    if (e.target === e.currentTarget) onClose();
  };

  return { panelRef, handleBackdrop };
}
