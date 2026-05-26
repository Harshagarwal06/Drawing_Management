import { useState } from "react";
import { ChevronRight, ChevronDown, Folder } from "lucide-react";

export default function FolderPicker({ node, path, selected, onSelect, depth = 0, disabledPrefix = "" }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isDisabled  = disabledPrefix && (path === disabledPrefix || path.startsWith(disabledPrefix + "/"));

  return (
    <div>
      <button
        onClick={() => !isDisabled && onSelect(path)}
        disabled={isDisabled}
        className={`w-full flex items-center gap-2 py-1.5 rounded-lg transition-colors text-left text-[13px] ${
          isDisabled
            ? "opacity-35 cursor-not-allowed text-on-surface-variant"
            : selected === path
              ? "bg-primary/10 text-primary font-semibold"
              : "text-on-surface hover:bg-surface-container-low"
        }`}
        style={{ paddingLeft: 12 + depth * 16, paddingRight: 12 }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            className="p-0.5 rounded hover:bg-black/8 shrink-0"
          >
            {expanded
              ? <ChevronDown size={13} className="text-on-surface-variant" />
              : <ChevronRight size={13} className="text-on-surface-variant" />}
          </span>
        ) : (
          <span className="w-[21px] shrink-0" />
        )}
        <Folder size={14} className={selected === path ? "text-primary shrink-0" : "text-on-surface-variant shrink-0"} />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <FolderPicker
              key={i}
              node={child}
              path={`${path}/${child.name}`}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
              disabledPrefix={disabledPrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}
