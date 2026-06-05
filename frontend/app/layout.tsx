import type { Metadata } from "next";
import "./globals.css";
import { CopilotKitProvider } from "@/components/CopilotKitProvider";

export const metadata: Metadata = {
  title: "Memorang Learning Agent — Spike",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <CopilotKitProvider>{children}</CopilotKitProvider>
      </body>
    </html>
  );
}
