import { Badge } from "@/components/shared/Badge";
import { PAYMENT_LABEL, USER_PAYMENT_LABEL, type PaymentStatus, type UserPaymentStatus } from "@/lib/admin/types";

export function UserPaymentBadge({ status }: { status: UserPaymentStatus }) {
  return <Badge tone={status === "PAID" ? "success" : status === "PENDING" ? "warning" : "muted"}>{USER_PAYMENT_LABEL[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={status === "CONFIRMED" ? "success" : status === "PENDING" ? "warning" : "danger"}>{PAYMENT_LABEL[status]}</Badge>;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums">{percent}%</span>
    </div>
  );
}
