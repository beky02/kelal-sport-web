import { describe, expect, it } from "vitest";
import {
  checkCharacter,
  normaliseTicketNumber,
} from "@/features/tickets/lib/number";
import { TICKET_NUMBER_PATTERN } from "@/lib/api/patterns";
import { example } from "../contract";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

describe("ticket numbers (D3)", () => {
  it.each(["K7Q2-M9XP-M", "R7K2-M9XP-K", "M3HX-7PQA-V"])(
    "accepts %s, D3's own example, check character and all",
    (number) => {
      expect(normaliseTicketNumber(number)).toBe(number);
      expect(checkCharacter(number.replace(/-/g, "").slice(0, 8))).toBe(
        number.at(-1),
      );
    },
  );

  it("accepts every ticket number in the contract's examples", () => {
    const numbers = [
      ...example("/v1/bets").items.map((bet) => bet.ticket_id),
      example("/v1/bets/{id}").ticket_id,
      example("/v1/tickets/{ticket_id}").ticket_id,
    ];
    for (const number of numbers) {
      expect(normaliseTicketNumber(number), number).toBe(number);
    }
  });

  it.each([
    ["k7q2-m9xp-m", "K7Q2-M9XP-M"],
    ["K7Q2M9XPM", "K7Q2-M9XP-M"],
    [" k7q2 m9xp m ", "K7Q2-M9XP-M"],
    ["r7k2--m9xp-k", "R7K2-M9XP-K"],
  ])("forgives case, spaces and hyphens: %j → %s", (typed, number) => {
    expect(normaliseTicketNumber(typed)).toBe(number);
  });

  it("reads O as 0 and I or L as 1, as the alphabet means them to be", () => {
    const body = "K0Q1M9XP";
    const check = checkCharacter(body);
    expect(normaliseTicketNumber(`KOQL-M9XP-${check}`)).toBe(
      `K0Q1-M9XP-${check}`,
    );
    expect(normaliseTicketNumber(`koqi m9xp ${check}`)).toBe(
      `K0Q1-M9XP-${check}`,
    );
  });

  it("catches every mistyped character, the check character included", () => {
    const number = "K7Q2M9XPM";
    for (let at = 0; at < number.length; at += 1) {
      for (const other of CROCKFORD) {
        if (other === number[at]) continue;
        const typo = `${number.slice(0, at)}${other}${number.slice(at + 1)}`;
        expect(normaliseTicketNumber(typo), typo).toBeNull();
      }
    }
  });

  it.each([
    "",
    "K7Q2-M9XP",
    "K7Q2-M9XP-MM",
    "K7Q2-M9XU-M",
    "K7Q2-M9XP-M.MAC",
    "CALL 0911000000 TO CLAIM",
    "K7Q2/M9XP/M",
  ])("refuses %j: not a ticket number", (typed) => {
    expect(normaliseTicketNumber(typed)).toBeNull();
  });

  it("always answers in the contract's TicketNo pattern", () => {
    expect(normaliseTicketNumber("m3hx7pqav")).toMatch(TICKET_NUMBER_PATTERN);
  });
});
