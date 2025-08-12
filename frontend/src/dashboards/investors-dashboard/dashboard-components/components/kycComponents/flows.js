export const INDIVIDUAL_FLOW = [
    "consent",
    "actorType",
    "personalInfo",
    "documentCapture",
    "address",
    "screening",
    "decision",
  ];
  
  export const COMPANY_FLOW = [
    "consent",
    "actorType",
    "companyLookup",
    "companyDetails",
    "ubos",
    "documentCapture", // representative/UBO KYC (placeholder)
    "screening",
    "decision",
  ];
  
  export const DEFAULT_SESSION = {
    status: "not_started",                // not_started | in_progress | pending_review | approved | declined
    actorType: "individual",              // individual | company
    consentAccepted: false,
  
    // Individual
    pii: { firstName: "", lastName: "", dob: "", nationality: "" },
  
    // Company
    company: { legalName: "", regNumber: "", country: "", address: "" },
    ubos: [],                             // { name, ownership }
  
    // Shared
    idVerified: false,
    addressVerified: false,
    screening: { status: "idle", hits: 0, notes: "" }, // idle | running | passed | review | failed
    decision: null,                                     // approved | pending_review | declined
  };
  