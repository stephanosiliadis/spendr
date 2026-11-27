"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "spendr.cookie.consent";

export type CookieConsent = "essential" | "accepted" | "rejected";

function CookieBanner() {
  const [hasConsent, setHasConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    setHasConsent(
      stored === "accepted" || stored === "rejected" ? stored : "essential",
    );
  }, []);

  useEffect(() => {
    if (hasConsent === "accepted" || hasConsent === "rejected") {
      localStorage.setItem(COOKIE_CONSENT_KEY, hasConsent);
    }
  }, [hasConsent]);

  if (hasConsent !== "essential") {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-border bg-card p-4 shadow-xl shadow-black/10 sm:left-auto sm:right-4 sm:w-[400px]"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-6">
          We use cookies to improve your experience. Accept to allow analytics
          and personalization.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHasConsent("rejected")}
          >
            Reject
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setHasConsent("accepted")}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

export { CookieBanner };
