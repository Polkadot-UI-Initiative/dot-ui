import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedCodeBlock } from "../animated-code-block";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="container relative">
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-2 py-8 md:py-12 md:pb-8 lg:py-24 lg:pb-20">
        <Link href="/blocks/block-number">
          <Button variant="outline" size="sm" className="group">
            🎉
            <span className="ml-2">New Block Number Component</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </Button>
        </Link>
        <h1 className="text-center text-3xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1]">
          Build your App with Polkadot Components
        </h1>
        <span className="max-w-[750px] text-center text-lg text-muted-foreground sm:text-xl">
          A set of beautifully-designed, accessible components for the Polkadot
          ecosystem. Type-safe, customizable, and built with modern React
          patterns. Open Source.
        </span>

        <div className="py-6">
          <AnimatedCodeBlock />
        </div>

        <div className="flex w-full items-center justify-center space-x-4 py-4 md:pb-10">
          <Button asChild size="default">
            <Link href="/docs">Get Started</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/components">Browse Components</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
