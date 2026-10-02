import { describe, expect, it } from "vitest";
import { maskPhone, toE164 } from "@/features/auth/lib/phone";
import { safeNextPath } from "@/features/auth/lib/paths";

describe("Ethiopian mobile numbers", () => {
  it("turns what a player types into the contract's +251 form", () => {
    expect(toE164("911234567")).toBe("+251911234567");
    expect(toE164("0911 234 567")).toBe("+251911234567");
    expect(toE164("+251 911 234 567")).toBe("+251911234567");
    expect(toE164("251711234567")).toBe("+251711234567");
    expect(toE164("7 1123 4567")).toBe("+251711234567");
  });

  it("refuses anything that is not one", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("811234567")).toBeNull();
    expect(toE164("+1 415 555 0100")).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("9112345678")).toBeNull();
  });

  it("masks a number down to its last three digits for the code step", () => {
    expect(maskPhone("+251911234567")).toBe("+251 9•• ••• 567");
    expect(maskPhone("+251711234482")).toBe("+251 7•• ••• 482");
  });
});

describe("the path to return to after logging in", () => {
  it("keeps a same-origin path, with its query", () => {
    expect(safeNextPath("/wallet")).toBe("/wallet");
    expect(safeNextPath("/my-bets/b1?tab=open")).toBe("/my-bets/b1?tab=open");
  });

  it("sends anything else home — another site, a protocol-relative URL, no path", () => {
    expect(safeNextPath("https://evil.example/wallet")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("wallet")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});
