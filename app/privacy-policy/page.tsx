"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function PrivacyPolicyContent() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Privacy Policy</h1>

      <div className="prose max-w-none">
        <p>
          We are committed to protecting your privacy. This privacy policy
          explains how we collect, use, and safeguard your information.
        </p>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Information We Collect</h2>
      <p>
        We collect information that you provide directly to us, such as when you
        create an account or use our services.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">How We Use Your Information</h2>
      <p>
        We use the information we collect to operate, maintain, and provide our
        services.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Data Storage</h2>
      <p>
        All transaction data is stored locally in your browser. We do not transmit
        your financial data to third parties.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Your Choices</h2>
      <p>
        You can manage your data and preferences at any time through the app
        settings.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Children's Privacy</h2>
      <p>
        Our service is not directed to children under the age of 13.
      </p>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-48 mt-3" />
        <Skeleton className="h-6 w-48 mt-3" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="flex-1 p-6 pt-20">
        <Card>
          <CardHeader className="pb-2 flex items-start gap-3">
            <CardTitle>Spendr — Privacy Policy</CardTitle>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="ml-auto"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <PrivacyPolicyContent />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}