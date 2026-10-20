import { pageTitle } from "@/lib/pageTitle";

export const generateMetadata = pageTitle("Attendance", "title");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
