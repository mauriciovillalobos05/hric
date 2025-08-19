import React, { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";

export default function PersonalInfoStep({ value, onChange, onBack, onNext }) {
  const [form, setForm] = useState(value);
  const canNext = form.firstName && form.lastName && form.dob;

  return (
    <div>
      <StepHeader title="Personal details" subtitle="Basic info for identity checks." />
      <Separator className="my-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>First name</Label>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <Label>Last name</Label>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div>
          <Label>Date of birth</Label>
          <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        </div>
        <div>
          <Label>Nationality</Label>
          <Select value={form.nationality || ""} onValueChange={(v) => setForm({ ...form, nationality: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MX">Mexico</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="CO">Colombia</SelectItem>
              <SelectItem value="CL">Chile</SelectItem>
            </SelectContent>
          </Select>
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
