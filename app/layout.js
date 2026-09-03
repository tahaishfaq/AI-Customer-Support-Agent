import { DM_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { GoogleGsiLoader } from "@/components/auth/GoogleGsiLoader";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "AIDE — AI Customer Support",
  description:
    "AI-powered customer support agents with conversation insights.",
  icons: {
    icon: [{ url: "/brand/aide-logo.png", type: "image/png" }],
    apple: [{ url: "/brand/aide-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} min-h-dvh antialiased`}
      suppressHydrationWarning
    >
      <head>
        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
          <>
            <link rel="preconnect" href="https://accounts.google.com" />
            <link rel="dns-prefetch" href="https://accounts.google.com" />
          </>
        ) : null}
      </head>
      <body
        className="flex min-h-dvh flex-col bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <GoogleGsiLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
