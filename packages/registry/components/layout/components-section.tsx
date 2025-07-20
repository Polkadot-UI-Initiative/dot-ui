import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { BlockNumber } from "@/registry/dot-ui/blocks/block-number/components/block-number.papi";
import { AddressInputWithProvider } from "@/registry/dot-ui/blocks/address-input/components/address-input.papi";

const examples = [
  {
    name: "Address Input",
    href: "/docs/components/address-input",
    code: "address-input",
    description:
      "Input component with SS58/Ethereum validation and identity lookup",
    component: (
      <AddressInputWithProvider className="w-full" truncate={8} format="both" />
    ),
  },
  {
    name: "Block Number DEMO",
    href: "/docs/components/block-number",
    code: "block-number",
    description: "Will not be part of the library",
    component: <BlockNumber />,
  },
];

// const categories = [
//   {
//     name: "Featured",
//     href: "/examples",
//     description: "Most popular Polkadot components",
//     className: "text-primary border-primary",
//   },
//   {
//     name: "Blockchain",
//     href: "/examples/blockchain",
//     description: "Core blockchain interactions",
//     className:
//       "text-muted-foreground border-transparent hover:border-muted-foreground",
//   },
//   {
//     name: "Wallet",
//     href: "/examples/wallet",
//     description: "Wallet connection and management",
//     className:
//       "text-muted-foreground border-transparent hover:border-muted-foreground",
//   },
//   {
//     name: "DeFi",
//     href: "/examples/defi",
//     description: "Decentralized finance components",
//     className:
//       "text-muted-foreground border-transparent hover:border-muted-foreground",
//   },
//   {
//     name: "Governance",
//     href: "/examples/governance",
//     description: "On-chain governance tools",
//     className:
//       "text-muted-foreground border-transparent hover:border-muted-foreground",
//   },
// ];

export function ComponentsSection() {
  return (
    <section className="container space-y-6 py-8 md:py-8 lg:py-12">
      {/* Examples grid */}
      <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
        {examples.map((example) => (
          <Card key={example.name} className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">{example.name}</CardTitle>
              <CardDescription>{example.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {example.component}
            </CardContent>
            <CardFooter className="flex items-center justify-between pt-0">
              <div className="text-xs text-muted-foreground font-mono">
                {example.code}
              </div>
              <Link
                href={example.href}
                className="text-xs text-primary hover:underline"
              >
                View →
              </Link>
            </CardFooter>
          </Card>
        ))}
        <Card className="relative overflow-hidden flex flex-col justify-center items-center">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">More Coming Soon</CardTitle>
          </CardHeader>
          <CardFooter className="flex items-center justify-center pt-0">
            <Link
              href="https://github.com/Polkadot-UI-Initiative/dot-ui"
              className="text-xs text-primary hover:underline"
            >
              View on GitHub →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
