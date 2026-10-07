import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";

function Reader() {
  useSportsbookChrome();
  return null;
}

describe("the sportsbook's chrome (F8ca review Q3)", () => {
  it("refuses to be read without a site's chrome above it, rather than unlocking prices", () => {
    expect(() => render(<Reader />)).toThrow(/SportsbookChrome/);
  });
});
