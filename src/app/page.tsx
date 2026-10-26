import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { PlatformStats } from "@/components/landing/PlatformStats";
import { AboutSection } from "@/components/landing/AboutSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { UserRolesSection } from "@/components/landing/UserRolesSection";
import { WhyMedoraSection } from "@/components/landing/WhyMedoraSection";
import { HealthAccessSection } from "@/components/landing/HealthAccessSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { CTASection } from "@/components/landing/CTASection";
import { ContactSection } from "@/components/landing/ContactSection";

export default function HomePage() {
  return (
    <>
      <span id="top" aria-hidden />
      <Navbar />
      <main>
        <HeroSection />
        <PlatformStats />
        <AboutSection />
        <HowItWorksSection />
        <FeaturesSection />
        <UserRolesSection />
        <WhyMedoraSection />
        <HealthAccessSection />
        <TestimonialsSection />
        <CTASection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
