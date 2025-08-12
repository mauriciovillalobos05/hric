import React, { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { Building2 } from "lucide-react";

export default function CompanyDetailsStep({ value, onChange, onBack, onNext }) {
  const [form, setForm] = useState(value);
  const canNext = form.legalName && form.regNumber && form.address;

  return (
    <div>
      <StepHeader icon={Building2} title="Company details" subtitle="Confirm legal registration details." />
      <Separator className="my-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Registration number</Label>
          <Input value={form.regNumber} onChange={(e) => setForm({ ...form, regNumber: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Registered address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </div>
      <StepControls
        onBack={() => { onChange(form); onBack(); }}
        onNext={() => { onChange(form); onNext(); }}
        nextDisabled={!canNext}
      />
    </div>
  );
}
