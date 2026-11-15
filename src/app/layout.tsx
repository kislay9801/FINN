import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./readability.css";
import "./login.css";
export const metadata: Metadata = {
  title: "FINN — Signal over Noise",
  description:
    "A primary-source intelligence desk for Indian equities. Discover what changed. Investigate why.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#163d32",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
