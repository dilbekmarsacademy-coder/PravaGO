import { describe, expect, it } from "vitest";
import { canonicalAdminPath } from "./path";

describe("canonicalAdminPath", () => {
  it("kanonik manzilga tegmaydi", () => {
    expect(canonicalAdminPath("/admin")).toBeNull();
    expect(canonicalAdminPath("/admin/login")).toBeNull();
    expect(canonicalAdminPath("/admin/users/cmAbC123")).toBeNull();
    expect(canonicalAdminPath("/admin/api/auth/login")).toBeNull();
  });

  it("katta harflarni kichik qiladi, ID'ni o'zgartirmaydi", () => {
    expect(canonicalAdminPath("/Admin")).toBe("/admin");
    expect(canonicalAdminPath("/ADMIN/Login")).toBe("/admin/login");
    expect(canonicalAdminPath("/Admin/Users/cmAbC123")).toBe("/admin/users/cmAbC123");
  });

  it("havola oxiridagi tinish belgilarini olib tashlaydi", () => {
    expect(canonicalAdminPath("/admin.")).toBe("/admin");
    expect(canonicalAdminPath("/admin/login),")).toBe("/admin/login");
    expect(canonicalAdminPath("/admin/login%22")).toBe("/admin/login");
    expect(canonicalAdminPath("/admin/dashboard/")).toBe("/admin/dashboard");
  });

  it("admin bo'lmagan manzillarga tegmaydi", () => {
    expect(canonicalAdminPath("/administrator")).toBeNull();
    expect(canonicalAdminPath("/kabinet")).toBeNull();
  });
});
