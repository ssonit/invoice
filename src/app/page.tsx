import type { Metadata } from "next"

import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: "Invoice Reader - AI invoice inbox",
  description:
    "Forward vendor invoices to your inbox. AI extracts totals, vendors, and due dates.",
}

export default function Home() {
  return <LandingPage />
}
