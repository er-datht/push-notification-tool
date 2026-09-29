import { useState } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  loginIds: string[];
  open: boolean;
  onToggle: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  /** Order push only — undefined hides the "Excluded login IDs" sub-section entirely. */
  excluded?: string[];
  onExcludeAdd?: (id: string) => void;
  onExcludeRemove?: (id: string) => void;
}

export function RecipientsSection({
  loginIds,
  open,
  onToggle,
  onAdd,
  onRemove,
  excluded,
  onExcludeAdd,
  onExcludeRemove,
}: Props) {
  const [newId, setNewId] = useState("");
  const [newExcl, setNewExcl] = useState("");

  const add = () => {
    const v = newId.trim();
    if (!v) return;
    onAdd(v);
    setNewId("");
  };

  const addExcl = () => {
    const v = newExcl.trim();
    if (!v || !onExcludeAdd) return;
    onExcludeAdd(v);
    setNewExcl("");
  };

  return (
    <Card id="ptc-recipients" className="mt-8">
      <button
        className="flex w-full items-center gap-3 rounded-lg px-5.5 py-[18px] text-left transition-colors hover:bg-[#fafbfc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold">Recipients</span>
        <Badge variant="secondary">{loginIds.length} accounts</Badge>
        {excluded && excluded.length > 0 && (
          <Badge variant="secondary" className="bg-red-tint text-red-ink">
            {excluded.length} excluded
          </Badge>
        )}
        <span className="ml-auto text-[13px] font-medium text-primary">
          {open ? "Hide" : "Edit"}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-[22px] px-5.5 pt-1 pb-6">
          <div>
            <p className="mb-4 max-w-[62ch] text-[13.5px] leading-relaxed font-light text-ink-2">
              Test accounts are pre-loaded for every run and shared across push
              types. Remove any you don&apos;t want to disturb, or add a
              teammate&apos;s login ID.
            </p>
            <div className="mb-[18px] flex flex-wrap gap-2">
              {loginIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted py-1.5 pr-2 pl-3 text-[13px]"
                >
                  {id}
                  <button
                    className="rounded-md px-0.5 text-ink-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onRemove(id)}
                    aria-label={`Remove ${id}`}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex max-w-[420px] items-end gap-2.5">
              <div className="flex-1">
                <Label htmlFor="ptc-new-id" className="mb-1.5">
                  Add login ID
                </Label>
                <Input
                  id="ptc-new-id"
                  placeholder="e-plus-test04"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
                  }}
                />
              </div>
              <Button variant="outline" className="h-[38px]" onClick={add}>
                Add
              </Button>
            </div>
          </div>

          {excluded && (
            <div className="border-t border-line-3 pt-5">
              <div className="mb-1 text-[14px] font-semibold">
                Excluded login IDs
              </div>
              <p className="mb-4 max-w-[62ch] text-[13.5px] leading-relaxed font-light text-ink-2">
                Order push only. These accounts are skipped even if they match
                an order below.
              </p>
              <div className="mb-[18px] flex flex-wrap gap-2">
                {excluded.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-tint py-1.5 pr-2 pl-3 text-[13px] text-red-ink"
                  >
                    {id}
                    <button
                      className="rounded-md px-0.5 text-red-ink/70 transition-colors hover:text-red-ink focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => onExcludeRemove?.(id)}
                      aria-label={`Remove excluded ${id}`}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </span>
                ))}
                {excluded.length === 0 && (
                  <span className="text-[13px] font-light text-ink-4">
                    No one excluded.
                  </span>
                )}
              </div>
              <div className="flex max-w-[420px] items-end gap-2.5">
                <div className="flex-1">
                  <Label htmlFor="ptc-new-excl" className="mb-1.5">
                    Exclude login ID
                  </Label>
                  <Input
                    id="ptc-new-excl"
                    placeholder="e-plus-test02"
                    value={newExcl}
                    onChange={(e) => setNewExcl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addExcl();
                      }
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-[38px]"
                  onClick={addExcl}
                >
                  Exclude
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
