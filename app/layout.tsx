import type { Metadata } from "next";
import "./globals.css";
import "./hospital.css";

export const metadata: Metadata = {
  title: "Homestead Clinic | Intake & Vaccination",
  description: "Fictional clinic intake and vaccination record accuracy demonstration.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
