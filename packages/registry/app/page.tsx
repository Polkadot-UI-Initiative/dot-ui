import { HeroSection } from "@/components/layout/hero-section";
import { ExamplesSection } from "@/components/layout/examples-section";

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <ExamplesSection />
    </div>
  );
}