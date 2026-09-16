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
}

export function RecipientsSection({
  loginIds,
  open,
  onToggle,
  onAdd,
  onRemove,
}: Props) {
  const [newId, setNewId] = useState("");

  const add = () => {
    const v = newId.trim();
    if (!v) return;
    onAdd(v);
    setNewId("");
  };

  return (
    <Card className="mt-8">
      <button
        className="flex w-full items-center gap-3 rounded-lg px-5.5 py-[18px] text-left transition-colors hover:bg-[#fafbfc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold">Recipients</span>
        <Badge variant="secondary">{loginIds.length} accounts</Badge>
        <span className="ml-auto text-[13px] font-medium text-primary">
          {open ? "Hide" : "Edit"}
        </span>
      </button>
      {open && (
        <div className="px-5.5 pt-1 pb-6">
          <p className="mb-4 max-w-[62ch] text-[13.5px] leading-relaxed font-light text-ink-2">
            These test accounts are pre-loaded for every run. Remove any you
            don't want to disturb, or add a login ID to include a teammate.
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
      )}
    </Card>
  );
}
