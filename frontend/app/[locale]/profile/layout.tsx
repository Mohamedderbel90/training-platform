import { pageTitle } from "@/lib/pageTitle";

export const generateMetadata = pageTitle("Nav", "profile");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
