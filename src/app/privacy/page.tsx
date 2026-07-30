import type { Metadata } from "next"

import { LegalPageClient } from "@/app/terms/page-client"

export const metadata: Metadata = {
  title: "Privacy Policy - Invoice Reader",
  description:
    "Privacy Policy for Invoice Reader — AI-powered invoice inbox.",
}

export default function PrivacyPage() {
  return <LegalPageClient page="privacy" />
}
