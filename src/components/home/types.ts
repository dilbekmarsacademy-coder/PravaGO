export type Step =
  | "hero"
  | "video"
  | "guide"
  | "category"
  | "register"
  | "otp"
  | "payment";

export type CategoryId = "failed_before" | "never_taken" | "revoked";

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
}
