import { pageTitle } from "@/lib/pageTitle";

export const generateMetadata = pageTitle("Nav", "terms");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
