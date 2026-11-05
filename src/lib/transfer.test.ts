import { describe, expect, it } from "vitest";
import { plainTarget, safeNextPath, transferTarget } from "./transfer";

describe("safeNextPath", () => {
  it("keeps internal paths with query and hash", () => {
    expect(safeNextPath("/kabinet")).toBe("/kabinet");
    expect(safeNextPath("/test/day1-topic1?x=1#q")).toBe("/test/day1-topic1?x=1#q");
  });

  it("rejects external, protocol-relative and odd values (open redirect)", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, undefined, "javascript:alert(1)", "/\tevil", "/%0a"]) {
      const out = safeNextPath(bad as string);
      expect(out.startsWith("/") && !out.startsWith("//")).toBe(true);
    }
    expect(safeNextPath("//evil.example")).toBe("/kabinet");
    expect(safeNextPath("https://evil.example/kabinet")).toBe("/kabinet");
    expect(safeNextPath("/\\evil.example")).toBe("/kabinet");
  });

  it("never loops back to the move or transfer pages", () => {
    expect(safeNextPath("/ko-chdi")).toBe("/kabinet");
    expect(safeNextPath("/auth/transfer?code=x")).toBe("/kabinet");
  });
});

describe("targets", () => {
  it("plain target keeps the old path on the new domain", () => {
    expect(plainTarget("/tolov?a=1")).toBe("https://www.pravaishonch.uz/tolov?a=1");
    expect(plainTarget("//evil.example")).toBe("https://www.pravaishonch.uz/");
  });

  it("transfer target sends only the code and a safe next path", () => {
    const url = new URL(transferTarget("abc_DEF-123", "/kabinet/saqlanganlar"));
    expect(url.origin).toBe("https://www.pravaishonch.uz");
    expect(url.pathname).toBe("/auth/transfer");
    expect(url.searchParams.get("code")).toBe("abc_DEF-123");
    expect(url.searchParams.get("next")).toBe("/kabinet/saqlanganlar");
    expect(new URL(transferTarget("c", "/")).searchParams.get("next")).toBe("/kabinet");
    expect(new URL(transferTarget("c", "//evil.example")).searchParams.get("next")).toBe("/kabinet");
  });
});
