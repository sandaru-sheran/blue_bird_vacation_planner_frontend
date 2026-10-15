import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bluebird · Vacation Planner",
  description: "Thoughtfully planned journeys through Sri Lanka.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
