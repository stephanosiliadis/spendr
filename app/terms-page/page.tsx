import { Scale } from "lucide-react";

import { LegalDocument, type LegalSection } from "@/components/legal-document";

const sections: LegalSection[] = [
  {
    title: "Account",
    body: "When you create an account on our application, you must provide accurate and complete information. You are responsible for maintaining the security of your account password.",
  },
  {
    title: "Purchases",
    body: "If the application offers purchasing functionality, you must provide accurate and complete billing information. You must be at least 18 years old to make purchases.",
  },
  {
    title: "Termination",
    body: "We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including violation of these terms of service.",
  },
  {
    title: "Miscellaneous",
    body: "These terms of service shall be governed by the laws of your jurisdiction, without regard to its conflict of law provisions. Our failure to exercise or enforce any right or provision of these terms shall not operate as a waiver of such right or provision.",
  },
];

export default function TermsPolicyPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="These terms govern your use of the Spendr application. By accessing or using the application, you agree to be bound by them."
      icon={Scale}
      sections={sections}
    />
  );
}
