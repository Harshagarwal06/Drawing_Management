import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import FolderPicker from "./FolderPicker";
import useModalClose from "./useModalClose";

export default function MoveFolderNodeModal({ folderName, folderPath, tree, onConfirm, onClose }) {
  const { handleBackdrop } = useModalClose(onClose);
  const parentPath    = folderPath.split("/").slice(0, -1).join("/");
  const [selectedPath, setSelectedPath] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const confirmDisabled = !selectedPath || selectedPath === parentPath;

  const handleMove = async () => {
    setLoading(true);
    setError("");
    try {
      await onConfirm(selectedPath);
      onClose();
    } catch {
      setError("Move failed — please try again.");
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Move folder"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
        <div className="h-1 bg-primary shrink-0" />
        <div className="px-6 py-4 border-b border-border-slate shrink-0">
          <h2 className="text-[15px] font-semibold text-on-surface">Move Folder</h2>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5 truncate">{folderName}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          {error && (
            <div className="mb-2 px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}
          <FolderPicker
            node={tree}
            path={tree.name}
            selected={selectedPath}
            onSelect={setSelectedPath}
            depth={0}
            disabledPrefix={folderPath}
          />
        </div>
        {selectedPath && (
          <div className="px-6 py-2 bg-surface-container-low border-t border-border-slate shrink-0">
            <p className="text-[11px] text-on-surface-variant font-mono truncate">→ {selectedPath}/{folderName}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-border-slate flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border-slate bg-white text-on-surface-variant hover:bg-surface-container text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={loading || confirmDisabled}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Moving…</> : "Move Here"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
