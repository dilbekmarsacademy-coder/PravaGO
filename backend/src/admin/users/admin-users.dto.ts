import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { PageQueryDto } from "../dto/admin-auth.dto";

export class UsersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["paid", "unpaid", "pending"])
  payment?: "paid" | "unpaid" | "pending";

  @IsOptional()
  @IsIn(["active", "inactive"])
  activity?: "active" | "inactive";

  @IsOptional()
  @IsIn(["registeredAt", "lastActiveAt", "name", "progress"])
  sort: "registeredAt" | "lastActiveAt" | "name" | "progress" = "registeredAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  dir: "asc" | "desc" = "desc";
}

export class UserIdParamDto {
  @IsUUID()
  id: string;
}

export class PaymentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["PENDING", "CONFIRMED", "CANCELLED"])
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CreatePaymentDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  amount?: number;

  @IsIn(["PENDING", "CONFIRMED"])
  status: "PENDING" | "CONFIRMED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PaymentActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
