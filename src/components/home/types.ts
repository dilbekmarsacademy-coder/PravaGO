export type ModalStep = "offer" | "status" | "form" | "otp" | "success";

export type ExamStatus = "first-time" | "failed-before" | "license-revoked";

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
  examStatus: ExamStatus | null;
}
