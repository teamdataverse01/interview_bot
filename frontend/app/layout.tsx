import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dataverse AI Interview Coach",
  description: "Practice realistic privacy-career interviews with AI trained on real interviews.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
