import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldControl } from "@/components/FieldControl";
import { FieldError } from "@/components/FieldText";
import { isExpandableCode } from "@/lib/fields";
import type { ItemGroupConfig, PushTypeConfig } from "@/lib/pushTypes";
import {
  errorsForField,
  hookKind,
  itemField,
  rowDomId,
  type FormRow,
  type RowError,
} from "@/lib/types";

interface Props {
  row: FormRow;
  group: ItemGroupConfig;
  pushType: PushTypeConfig;
  errors: RowError[];
  onPatchItem: (itemId: number, key: string, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: number) => void;
}

const EXPANSION_HINT =
  "No P021… part, so the server looks up every performance under this code (up to 200). That is slow and may create many topics.";

/** The shows or order lines inside one notification: a sub-panel per item, add and remove. */
export function ItemList({
  row,
  group,
  pushType,
  errors,
  onPatchItem,
  onAddItem,
  onRemoveItem,
}: Props) {
  const noun = group.noun.toLowerCase();
  const hasHook = group.fields.some((f) => f.key === "hook");
  const kind = hasHook ? hookKind(row.items) : null;
  const listErrors = errorsForField(errors, group.key);
  const fixed = Object.entries(group.fixed ?? {});

  return (
    <div className="col-span-6 min-[700px]:col-span-12">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold">{group.noun}s</span>
        <Badge variant="secondary">{row.items.length}</Badge>
        {kind && (
          <Badge
            variant="secondary"
            className={
              kind === "mixed" ? "bg-blue-chip text-blue-dark" : undefined
            }
          >
            {kind} push
          </Badge>
        )}
        {fixed.map(([k, val]) => (
          <span key={k} className="text-[12.5px] font-light text-ink-4">
            {k}: <span className="font-mono text-ink-3">{val}</span> (fixed)
          </span>
        ))}
      </div>
      {hasHook && (
        <p className="mb-3 text-[12.5px] font-light text-ink-4">
          Shows with different types in one notification make a mixed push.
        </p>
      )}
      <FieldError messages={listErrors} />

      <div className="flex flex-col gap-3">
        {row.items.map((item, j) => {
          const idPrefix = `${rowDomId(row.id)}-item-${item.id}`;
          return (
            <div
              key={item.id}
              className="rounded-lg border border-line-3 bg-[#fafbfc] px-4 pt-3 pb-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink-2">
                  {group.noun} {j + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={row.items.length === 1}
                  title={
                    row.items.length === 1
                      ? `A notification needs at least one ${noun}`
                      : undefined
                  }
                  aria-label={`Remove ${noun} ${j + 1}`}
                  onClick={() => onRemoveItem(item.id)}
                >
                  <XIcon />
                </Button>
              </div>
              <div className="grid grid-cols-6 gap-x-5 gap-y-4 min-[700px]:grid-cols-12">
                {group.fields.map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    values={item.values}
                    idPrefix={idPrefix}
                    messages={errorsForField(
                      errors,
                      itemField(group, j, f.key),
                    )}
                    onChange={(key, value) => onPatchItem(item.id, key, value)}
                    hint={
                      pushType.id === "normal_push" &&
                      f.key === "code" &&
                      isExpandableCode(item.values.code ?? "")
                        ? EXPANSION_HINT
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="mt-3 h-auto border border-dashed border-[#cfd5e0] px-3.5 py-2 text-[13px] font-medium hover:border-primary"
        onClick={onAddItem}
      >
        + Add {noun}
      </Button>
    </div>
  );
}
