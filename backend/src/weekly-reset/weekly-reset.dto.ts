import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { PageQueryDto } from "../admin/dto/admin-auth.dto";

/** "Hozir yangilash": admin "YANGILASH" so'zini yozishi shart. */
export class ManualResetDto {
  @IsIn(["YANGILASH"], { message: "Tasdiqlash uchun YANGILASH so'zini yozing" })
  confirm: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class ExemptDto {
  @IsBoolean()
  enabled: boolean;
}

export class ArchiveUserParamDto {
  @IsUUID()
  id: string;
}

/** "current" — joriy (arxivlanmagan) natijalar. */
export class ArchiveWeekParamDto extends ArchiveUserParamDto {
  @IsString()
  @MaxLength(40)
  @Matches(/^[\w:.-]+$/)
  weekKey: string;
}

export class WeekParamDto {
  @IsString()
  @MaxLength(40)
  @Matches(/^[\w:.-]+$/)
  weekKey: string;
}

export class WeekUsersQueryDto extends PageQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(100)
  q?: string;
}
