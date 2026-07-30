import type { Metadata } from "next"

import { LegalPageClient } from "./page-client"

export const metadata: Metadata = {
  title: "Terms of Service - Invoice Reader",
  description:
    "Terms of Service for Invoice Reader — AI-powered invoice inbox.",
}

export default function TermsPage() {
  return <LegalPageClient page="terms" />
}
