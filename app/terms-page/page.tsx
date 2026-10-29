"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function TermsContent() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Terms of Service</h1>

      <div className="prose max-w-none">
        <p>
          These terms of service govern your use of the Spendr expense tracking
          application. By accessing or using the service, you agree to these terms.
        </p>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Acceptance of Terms</h2>
      <p>
        By visiting, accessing, or using the Spendr application, you accept these
        terms and conditions. If you do not agree with any part of the terms, you
        may not access the service.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">User Conduct</h2>
      <p>
        Users agree to use the service lawfully and responsibly. You are solely
        responsible for any content you submit, post, or display on the service.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Privacy</h2>
      <p>
        Our privacy policy explains how we handle your information. Please review
        it alongside these terms.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Termination</h2>
      <p>
        We may terminate or suspend your account immediately, without prior notice,
        for reasons including but not limited to breach of these terms.
      </p>

      <h2 className="text-2xl font-semibold tracking-tight mb-4">Changes to Terms</h2>
      <p>
        We reserve the right to modify these terms at any time. Changes will be
        effective when posted on this page.
      </p>
    </div>
  );
}

export default function TermsPage() {
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
            <TermsContent />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}