import { PUSH_TYPE_ORDER, PUSH_TYPES, type PushTypeId } from "@/lib/pushTypes";
import { cn } from "@/lib/utils";

interface Props {
  active: PushTypeId;
  onSelect: (id: PushTypeId) => void;
  className?: string;
}

/** The push-type list. Lives in the left column on wide screens and in the left Drawer on narrow ones. */
export function Sidebar({ active, onSelect, className }: Props) {
  return (
    <aside
      className={cn(
        "overflow-y-auto bg-sidebar py-7 text-sidebar-foreground",
        className,
      )}
    >
      <div className="px-5 pb-3.5 text-[11px] font-semibold tracking-[0.09em] text-navy-label uppercase">
        Push types
      </div>
      <div className="flex flex-col gap-0.5 px-3">
        {PUSH_TYPE_ORDER.map((id) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(id)}
              className={cn(
                "flex flex-col items-start gap-px rounded-lg px-3.5 py-[10px] text-left transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "text-sm",
                  isActive ? "font-semibold" : "font-light text-navy-muted",
                )}
              >
                {PUSH_TYPES[id].label}
              </span>
              <span
                className={cn(
                  "text-[11.5px] font-light",
                  isActive
                    ? "text-sidebar-primary-foreground/85"
                    : "text-navy-label",
                )}
              >
                {PUSH_TYPES[id].jp}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
