import React, { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { User } from "lucide-react";

export default function UboStep({ ubos, onChange, onBack, onNext }) {
  const [list, setList] = useState(ubos || []);
  const [draft, setDraft] = useState({ name: "", ownership: "" });

  const addUbo = () => {
    if (!draft.name || !draft.ownership) return;
    const pct = Math.max(0, Math.min(100, parseFloat(draft.ownership)));
    const next = [...list, { name: draft.name, ownership: pct }];
    setList(next);
    setDraft({ name: "", ownership: "" });
  };

  return (
    <div>
      <StepHeader icon={User} title="Ultimate Beneficial Owners (UBOs)"
        subtitle="Add owners with ≥25% (or per policy)." />
      <Separator className="my-3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <Label>Name</Label>
          <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Jane Doe" />
        </div>
        <div className="md:col-span-1">
          <Label>Ownership %</Label>
          <Input type="number" value={draft.ownership}
            onChange={(e) => setDraft((d) => ({ ...d, ownership: e.target.value }))} placeholder="e.g., 30" />
        </div>
        <div className="md:col-span-1 flex items-end">
          <Button className="w-full" onClick={addUbo}>Add UBO</Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {list.length === 0 ? (
          <p className="text-sm text-gray-500">No UBOs added yet.</p>
        ) : (
          list.map((u, i) => (
            <div key={i} className="flex items-center justify-between border rounded-lg p-2">
              <div className="text-sm">
                <div className="font-medium">{u.name}</div>
                <div className="text-gray-500">{u.ownership}% ownership</div>
              </div>
              <Button variant="ghost" onClick={() => setList((prev) => prev.filter((_, idx) => idx !== i))}>
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      <StepControls
        onBack={() => { onChange(list); onBack(); }}
        onNext={() => { onChange(list); onNext(); }}
        nextDisabled={list.length === 0}
      />
    </div>
  );
}
