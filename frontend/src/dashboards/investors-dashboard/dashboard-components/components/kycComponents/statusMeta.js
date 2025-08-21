// One place for labels, colors, and explanatory text per status
export const STATUS_META = {
    not_started: {
      label: "Not started",
      badgeClass: "bg-gray-100 text-gray-700",
      helpText:
        "You haven’t started verification yet. It typically takes ~3–5 minutes and you can pause/resume anytime.",
    },
    in_progress: {
      label: "In progress",
      badgeClass: "bg-blue-100 text-blue-700",
      helpText:
        "Your verification is in progress. You can continue where you left off at any time.",
    },
    pending_review: {
      label: "Needs review",
      badgeClass: "bg-yellow-100 text-yellow-800",
      helpText:
        "Your verification is awaiting manual review. We’ll notify you by email—this usually completes within 24 hours.",
    },
    approved: {
      label: "Verified",
      badgeClass: "bg-green-100 text-green-800",
      helpText:
        "You have completed KYC/AML verification and can now access all investment features.",
    },
    declined: {
      label: "Declined",
      badgeClass: "bg-red-100 text-red-800",
      helpText:
        "Your verification was declined. Please re-check your details and try again, or contact support if you believe this is an error.",
    },
  };
  
  export function getStatusMeta(status = "not_started") {
    return STATUS_META[status] || STATUS_META.not_started;
  }
  