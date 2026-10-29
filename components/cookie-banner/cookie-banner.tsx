"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COOKIE_CONSENT_KEY = "spendr.cookie.consent";

export type CookieConsent = "essential" | "accepted";

function CookieBanner() {
  const [hasConsent, setHasConsent] = useState<CookieConsent>("essential");

  const hasAccepted = hasConsent === "accepted";

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      setHasConsent(stored as CookieConsent);
    }
  }, []);

  useEffect(() => {
    if (hasConsent !== "essential") {
      localStorage.setItem(COOKIE_CONSENT_KEY, hasConsent);
    }
  }, [hasConsent]);

  if (hasConsent === "essential") {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border z-50">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-foreground">
            We use cookies to improve your experience. Please accept for
            analytics and personalization features.
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHasConsent("essential")}
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

  return null;
}

export { CookieBanner };