import { pageTitle } from "@/lib/pageTitle";

export const generateMetadata = pageTitle("Auth", "title");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
