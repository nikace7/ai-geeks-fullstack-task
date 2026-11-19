import { describe, expect, it } from "vitest";
import { percent, plural, timeAgo } from "./format";

describe("timeAgo", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("reads 'just now' under a minute", () => {
    expect(timeAgo(new Date(now - 30_000), now)).toBe("just now");
  });

  it("uses the largest whole unit", () => {
    expect(timeAgo(new Date(now - 5 * 60_000), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date(now - 90 * 60_000), now)).toBe("1 hour ago");
    expect(timeAgo(new Date(now - 86_400_000), now)).toBe("yesterday");
    expect(timeAgo("2026-11-06T12:00:00Z", now)).toBe("2 weeks ago");
  });
});

describe("plural", () => {
  it("adds an s except for one", () => {
    expect(plural(1, "question")).toBe("1 question");
    expect(plural(0, "question")).toBe("0 questions");
    expect(plural(1200, "response")).toBe("1,200 responses");
  });
});

describe("percent", () => {
  it("rounds to a whole number and treats an empty total as 0%", () => {
    expect(percent(14, 17)).toBe(82);
    expect(percent(0, 0)).toBe(0);
  });
});
