import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CenterLoginDto {
  @IsString()
  @MaxLength(30)
  phone: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  login: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}

/** Bir martalik transfer kodi: 32 bayt base64url (43 belgi). */
export class TransferExchangeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code: string;
}
