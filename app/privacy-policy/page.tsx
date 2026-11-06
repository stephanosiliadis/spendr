import { ShieldCheck } from "lucide-react";

import { LegalDocument, type LegalSection } from "@/components/legal-document";

const sections: LegalSection[] = [
  {
    title: "Information We Collect",
    body: "We collect information that you provide directly to us, such as when you create an account or use our services.",
  },
  {
    title: "How We Use Your Information",
    body: "We use the information we collect to operate, maintain, and provide our services.",
  },
  {
    title: "Data Storage",
    body: "All transaction data is stored locally in your browser. We do not transmit your financial data to third parties.",
  },
  {
    title: "Your Choices",
    body: "You can manage your data and preferences at any time through the app settings.",
  },
  {
    title: "Children Privacy",
    body: "Our service is not directed to children under the age of 13.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="We are committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information."
      icon={ShieldCheck}
      sections={sections}
    />
  );
}
