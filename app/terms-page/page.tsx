"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function TermsPolicyContent() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Terms of Service</h1>

      <div className="prose max-w-none">
        <p>
          These terms of service govern your use of our application. By accessing
          or using the application, you agree to be bound by these terms of
          service.
        </p>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Account</h2>
      <p>
        When you create an account on our application, you must provide accurate
        and complete information. You are responsible for maintaining the
        security of your account password.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Purchases</h2>
      <p>
        If the application offers purchasing functionality, you must provide
        accurate and complete billing information. You must be at least 18 years
        old to make purchases.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Termination</h2>
      <p>
        We may terminate or suspend your account immediately, without prior notice
        or liability, for any reason whatsoever, including violation of these
        terms of service.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Miscellaneous</h2>
      <p>
        These terms of service shall be governed by the laws of your
        jurisdiction, without regard to its conflict of law provisions. Our
        failure to exercise or enforce any right or provision of these terms
        shall not operate as a waiver of such right or provision.
      </p>
    </div>
  );
}

export default function TermsPolicyPage() {
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
            <CardTitle>Spendr — Terms of Service</CardTitle>

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
            <TermsPolicyContent />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}