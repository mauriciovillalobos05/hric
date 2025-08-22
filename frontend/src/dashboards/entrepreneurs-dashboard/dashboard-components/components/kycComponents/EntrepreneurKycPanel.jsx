// src/dashboards/entrepreneurs-dashboard/dashboard-components/components/kycComponents/EntrepreneurKycPanel.jsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Star, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
// Use the same named exports the investor panel uses
import {
  VerificationEntryCard,
  VerificationWizard,
} from "@/dashboards/investors-dashboard/dashboard-components/components/kycComponents";

/**
 * Entrepreneur-facing verification panel.
 * Mirrors InvestorKycPanel, but with entrepreneur copy.
 */
export default function EntrepreneurKycPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("not_started");

return (
  <Card className="w-full rounded-2xl shadow-md">
    <CardHeader className="pb-2">
      <div className="text-sm font-semibold text-blue-700">
        Thursday, October 9, 2025 • 6:00 PM – 8:00 PM
      </div>
      <CardTitle className="mt-1 text-2xl text-blue-800">
        HRIC October 2025 - Innovation & Investment Launch
      </CardTitle>
    </CardHeader>

    <CardContent className="space-y-3">
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-gray-500 mt-1" />
        <p>
          <span className="font-semibold">Venue:</span>{" "}
          Hyatt Andares, Guadalajara
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Star className="h-4 w-4 text-gray-500 mt-1" />
        <p>
          <span className="font-semibold">Featured:</span>{" "}
          5 Sharks, Roberto Arechederra, Startup Presentations, Possible Investors Attending
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Medal className="h-4 w-4 text-gray-500 mt-1" />
        <p>
          <span className="font-semibold">Special:</span>{" "}
          VIP Cocktail Hour, Networking, Social Impact Showcase
        </p>
      </div>

      <div className="pt-4">
        <Button asChild className="w-full sm:w-auto">
          <a
            href={
              "mailto:mateo.uribe@intelleges.com" +
              "?subject=" +
              encodeURIComponent("Application: HRIC October 2025 Event") +
              "&body=" +
              encodeURIComponent(
                "Hi Mateo,\n\nI'd like to apply for the HRIC October 2025 event.\n\nName:\nCompany:\nRole:\nPhone:\nWebsite/LinkedIn:\n\nThanks!"
              )
            }
          >
            Apply
          </a>
        </Button>
      </div>
    </CardContent>
  </Card>
);
}