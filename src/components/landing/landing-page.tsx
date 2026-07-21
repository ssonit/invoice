"use client"

import { LandingFeaturesPan } from "@/components/landing/features-pan"
import { LandingFinalCta } from "@/components/landing/final-cta"
import { LandingFooter } from "@/components/landing/footer"
import { LandingHero } from "@/components/landing/hero"
import { LandingHowItWorks } from "@/components/landing/how-it-works"
import { LandingI18nProvider } from "@/components/landing/landing-i18n"
import { LandingThemeProvider } from "@/components/landing/landing-theme"
import { LandingNav } from "@/components/landing/nav"
import { LandingPricing } from "@/components/landing/pricing"
import { LandingTestimonial } from "@/components/landing/testimonial"
import { LandingTrustMarquee } from "@/components/landing/trust-marquee"
import { LenisProvider } from "@/components/landing/lenis-provider"
import { LandingScrollbar } from "@/components/landing/scroll-progress"
import { LandingScrollToTop } from "@/components/landing/scroll-to-top"

export function LandingPage() {
  return (
    <LandingI18nProvider>
      <LandingThemeProvider>
        <LenisProvider>
          <LandingScrollbar />
          <LandingScrollToTop />
          <LandingNav />
          <main className="pt-16">
            <LandingHero />
            <LandingTrustMarquee />
            <div id="how" className="scroll-mt-24">
              <LandingHowItWorks />
            </div>
            <LandingFeaturesPan />
            <LandingPricing />
            <LandingTestimonial />
            <LandingFinalCta />
          </main>
          <LandingFooter />
        </LenisProvider>
      </LandingThemeProvider>
    </LandingI18nProvider>
  )
}
