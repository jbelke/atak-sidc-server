import type { Metadata } from "next";

// The library page is a client component, so its title is set here.
export const metadata: Metadata = {
  title: "Symbol library",
};

export default function LibraryLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
