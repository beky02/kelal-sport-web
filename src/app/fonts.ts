import { Barlow, Barlow_Condensed, Noto_Sans_Ethiopic } from "next/font/google";

/**
 * The type both sites use (FD1): each root layout puts these variables on its
 * `<html>`, and the tokens in `globals.css` read them.
 */
export const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

/**
 * Amharic. Loaded as a variable font because the design condenses its `wdth`
 * axis to 82% so headings sit with Barlow Condensed.
 */
export const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
  display: "swap",
});

/** The class that puts all three on `<html>`. */
export const fontVariables = `${barlow.variable} ${barlowCondensed.variable} ${notoEthiopic.variable}`;
