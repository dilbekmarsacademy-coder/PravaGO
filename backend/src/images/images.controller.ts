import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { SkipThrottle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsUUID, Max, Min, ValidateNested } from "class-validator";
import type { Response } from "express";
import { AdminGuard, CurrentAdmin, RequestIp, RequirePermission } from "../admin/admin.guard";
import type { AdminUser } from "../admin/admin-request";
import { ImagesService, MAX_UPLOAD_BYTES } from "./images.service";

class RectDto {
  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
  @IsNumber() @Min(0) @Max(1) w: number;
  @IsNumber() @Min(0) @Max(1) h: number;
}

class JobDto {
  @IsUUID()
  inputAssetId: string;

  @IsIn(["auto", "manual", "original", "remove-bg"])
  type: "auto" | "manual" | "original" | "remove-bg";

  @IsOptional()
  @ValidateNested()
  @Type(() => RectDto)
  crop?: RectDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RectDto)
  erase?: RectDto[];

  @IsOptional()
  @IsBoolean()
  trim?: boolean;
}

class AcceptDto {
  @IsUUID()
  assetId: string;
}

@Controller("admin/images")
@UseGuards(AdminGuard)
@RequirePermission("new-tests")
export class AdminImagesController {
  constructor(private readonly images: ImagesService) {}

  /** Yuklash (multipart "file") — avtomatik tozalash vazifasi darhol boshlanadi. */
  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.images.upload(admin, ip, file);
  }

  /** Qayta urinish, qo'lda crop/o'chirish, asl rasm, fonni kesish. */
  @Post("jobs")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createJob(@Body() body: JobDto, @CurrentAdmin() admin: AdminUser) {
    return this.images.createJob(admin, body.inputAssetId, body.type, { crop: body.crop, erase: body.erase, trim: body.trim });
  }

  @Get("jobs/:id")
  @SkipThrottle()
  job(@Param("id", ParseUUIDPipe) id: string) {
    return this.images.job(id);
  }

  @Post("accept")
  @HttpCode(200)
  accept(@Body() body: AcceptDto, @CurrentAdmin() admin: AdminUser, @RequestIp() ip: string) {
    return this.images.accept(admin, ip, body.assetId);
  }

  @Get("assets/:id")
  async asset(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const asset = await this.images.adminAsset(id);
    res.setHeader("Content-Type", asset.mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(asset.data);
  }
}

/** Saytdagi rasmlar: /media/<id>.webp — faqat tasdiqlanganlari, uzoq muddatli kesh. */
@Controller("media")
@SkipThrottle()
export class MediaController {
  constructor(private readonly images: ImagesService) {}

  @Get(":file")
  async get(@Param("file") file: string, @Res() res: Response) {
    const match = /^([0-9a-f-]{36})\.webp$/.exec(file);
    const asset = match ? await this.images.publicAsset(match[1]) : null;
    if (!asset) throw new NotFoundException();
    res.setHeader("Content-Type", asset.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.send(asset.data);
  }
}
