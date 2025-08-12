import React, { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { Search } from "lucide-react";

export default function CompanyLookupStep({ value, onChange, onBack, onNext }) {
  const [form, setForm] = useState(value);

  return (
    <div>
      <StepHeader icon={Search} title="Find your company"
        subtitle="Search your legal entity (registry integration later)." />
      <Separator className="my-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Company name</Label>
          <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </div>
        <div>
          <Label>Country of registration</Label>
          <Select value={form.country || ""} onValueChange={(v) => setForm({ ...form, country: v })}>
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
      <div className="mt-3 text-xs text-gray-500">
        Tip: You’ll confirm registry details in the next step.
      </div>
      <StepControls
        onBack={() => { onChange(form); onBack(); }}
        onNext={() => { onChange(form); onNext(); }}
        nextDisabled={!form.legalName || !form.country}
      />
    </div>
  );
}
