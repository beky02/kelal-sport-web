import type { Metadata, Viewport } from "next";
import { UI_STORAGE_KEY } from "@/stores/ui.store";
import { fontVariables } from "../fonts";
import { Providers } from "./providers";
import "../globals.css";

export const metadata: Metadata = {
  title: "KelalSport",
  description: "Sports betting in Ethiopia — odds, live scores and bet slip.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1116" },
    { media: "(prefers-color-scheme: light)", color: "#e4e8ee" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the saved theme and language before first paint.
 *
 * Without this the page renders dark, then snaps to light for a user who chose
 * light — the one flash worth a blocking script.
 */
const preferenceScript = `
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem(${JSON.stringify(UI_STORAGE_KEY)}) || "{}");
    var s = saved.state || {};
    document.documentElement.dataset.theme = s.theme === "light" ? "light" : "dark";
    document.documentElement.lang = s.lang === "am" ? "am" : "en";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body className="bg-ground text-text flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
