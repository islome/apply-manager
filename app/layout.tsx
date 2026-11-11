import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DashboardShell from "./DashboardShell";
import { LanguageProvider } from "@/i18n/LanguageProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobBor | HR ",
  description: "JobBor recruitment management dashboard",
};

// Right after sign-in (see LoginForm) the first app page plays the hand-off once (globals.css).
// Runs before the first paint so the page never flashes sharp first. The stored value is the photo
// the login page showed (only our own image URLs are accepted); the flag is cleared when the
// animation ends, not on a timer, so a slow first paint can't cut it off.
const HANDOFF_IN = `try{var v=sessionStorage.getItem("hr-handoff");if(v){sessionStorage.removeItem("hr-handoff");var d=document.documentElement;if(!matchMedia("(prefers-reduced-motion: reduce)").matches){if(/^(\\/_next\\/image\\?|https:\\/\\/images\\.unsplash\\.com\\/)/.test(v))d.style.setProperty("--handoff-photo",'url("'+v.replace(/["\\\\]/g,"")+'")');d.dataset.handoff="in";var done=function(e){if(!e||e.animationName==="handoff-in"){delete d.dataset.handoff;d.style.removeProperty("--handoff-photo");removeEventListener("animationend",done)}};addEventListener("animationend",done);setTimeout(done,15000)}}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uz"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning // data-handoff is set by HANDOFF_IN before React hydrates
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HANDOFF_IN }} />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <DashboardShell>{children}</DashboardShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
