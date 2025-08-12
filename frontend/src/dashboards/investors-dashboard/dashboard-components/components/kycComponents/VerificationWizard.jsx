import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { INDIVIDUAL_FLOW, COMPANY_FLOW, DEFAULT_SESSION } from "./flows";

// Steps
import ConsentStep from "./steps/ConsentStep";
import ProfileTypeStep from "./steps/ProfileTypeStep";
import PersonalInfoStep from "./steps/PersonalInfoStep";
import CompanyLookupStep from "./steps/CompanyLookupStep";
import CompanyDetailsStep from "./steps/CompanyDetailsStep";
import UboStep from "./steps/UboStep";
import DocumentCaptureStep from "./steps/DocumentCaptureStep";
import AddressVerificationStep from "./steps/AddressVerificationStep";
import ScreeningStep from "./steps/ScreeningStep";
import DecisionStep from "./steps/DecisionStep";

export default function VerificationWizard({ open, onOpenChange, onComplete }) {
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => (session.actorType === "company" ? COMPANY_FLOW : INDIVIDUAL_FLOW),
    [session.actorType]
  );
  const stepKey = steps[stepIndex];

  const goNext = () => {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
    else {
      const finalStatus = session.decision === "approved" ? "approved" : "pending_review";
      setSession((s) => ({ ...s, status: finalStatus }));
      onComplete?.(finalStatus);
      onOpenChange(false);
    }
  };
  const goBack = () => { if (stepIndex > 0) setStepIndex((i) => i - 1); };

  useEffect(() => {
    if (open) {
      setSession((s) => ({ ...DEFAULT_SESSION, status: "in_progress" }));
      setStepIndex(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verification</DialogTitle>
          <DialogDescription>Step {stepIndex + 1} of {steps.length}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {stepKey === "consent" && (
            <ConsentStep
              accepted={session.consentAccepted}
              onChange={(v) => setSession((s) => ({ ...s, consentAccepted: v }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "actorType" && (
            <ProfileTypeStep
              value={session.actorType}
              onChange={(v) => setSession((s) => ({ ...s, actorType: v }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "personalInfo" && (
            <PersonalInfoStep
              value={session.pii}
              onChange={(pii) => setSession((s) => ({ ...s, pii }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "companyLookup" && (
            <CompanyLookupStep
              value={session.company}
              onChange={(company) => setSession((s) => ({ ...s, company }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "companyDetails" && (
            <CompanyDetailsStep
              value={session.company}
              onChange={(company) => setSession((s) => ({ ...s, company }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "ubos" && (
            <UboStep
              ubos={session.ubos}
              onChange={(ubos) => setSession((s) => ({ ...s, ubos }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "documentCapture" && (
            <DocumentCaptureStep
              idVerified={session.idVerified}
              onVerify={() => setSession((s) => ({ ...s, idVerified: true }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "address" && (
            <AddressVerificationStep
              verified={session.addressVerified}
              onVerify={() => setSession((s) => ({ ...s, addressVerified: true }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "screening" && (
            <ScreeningStep
              screening={session.screening}
              run={() => setSession((s) => ({ ...s, screening: { status: "passed", hits: 0, notes: "Demo pass (stub)" } }))}
              flag={() => setSession((s) => ({ ...s, screening: { status: "review", hits: 2, notes: "Potential name match (stub)" } }))}
              fail={() => setSession((s) => ({ ...s, screening: { status: "failed", hits: 1, notes: "Sanctions hit (stub)" } }))}
              onBack={goBack} onNext={goNext}
            />
          )}
          {stepKey === "decision" && (
            <DecisionStep
              screening={session.screening}
              decision={session.decision}
              onDecide={(d) => setSession((s) => ({ ...s, decision: d }))}
              onBack={goBack} onNext={goNext}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
