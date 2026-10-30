import { IsString, MaxLength, MinLength } from "class-validator";

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
