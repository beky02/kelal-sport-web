import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { RulesUnavailable } from "@/features/config/components/RulesUnavailable";
import { taxLabel } from "@/features/bet-slip/lib/tax-lines";
import { useUiStore } from "@/stores/ui.store";
import { render } from "./render";

describe("RulesUnavailable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("explains the dashes and offers a retry when the rule set fails to load", async () => {
    useUiStore.setState({ lang: "en" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<RulesUnavailable />, { rules: null });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load the betting rules");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("says nothing once the rules are there", () => {
    render(<RulesUnavailable />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("tax names", () => {
  it("calls a tax code the app does not know just 'Tax', never 'Winnings tax'", () => {
    expect(taxLabel("SOMETHING_NEW")).toBe("betSlip.tax");
    expect(taxLabel("WIN_TAX")).toBe("betSlip.winTax");
  });
});
