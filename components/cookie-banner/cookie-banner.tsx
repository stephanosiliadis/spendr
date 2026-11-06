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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-screen-md items-center gap-3 px-4 py-3">
        <span className="text-sm text-foreground">
          We use cookies to improve your experience. Please accept for
          analytics and personalization features.
        </span>
        <div className="flex gap-2">
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
