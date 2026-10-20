import { pageTitle } from "@/lib/pageTitle";

export const generateMetadata = pageTitle("Auth", "forgotTitle");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
