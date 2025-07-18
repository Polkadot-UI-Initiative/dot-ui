import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/app/docs/layout.config";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions}
      nav={{
        enabled: false,
      }}
      sidebar={{
        className: "mt-14",
        collapsible: false,
      }}
    >
      {children}
    </DocsLayout>
  );
}
