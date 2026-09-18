export type ModalStep = "offer" | "form" | "otp" | "success";

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
}
