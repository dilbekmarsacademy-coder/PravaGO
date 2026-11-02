import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createStorage, storageDriverName, type StorageDriver, type UploadTarget } from "./storage";

@Injectable()
export class StorageService {
  private driver: StorageDriver | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Drayver birinchi kerak bo'lganda yaratiladi (env so'rov vaqtida o'qiladi). */
  get storage(): StorageDriver {
    this.driver ??= createStorage(this.prisma);
    return this.driver;
  }

  get driverName() {
    return storageDriverName();
  }

  get maxUploadBytes(): number {
    return this.storage.maxUploadBytes;
  }

  put(key: string, data: Buffer, contentType: string) {
    return this.storage.put(key, data, contentType);
  }

  get(key: string) {
    return this.storage.get(key);
  }

  delete(key: string) {
    return this.storage.delete(key);
  }

  /** s3 — presigned PUT; boshqalar — backend orqali multipart (POST). */
  async uploadTarget(key: string, contentType: string): Promise<UploadTarget> {
    const driver = this.storage;
    if (driver.presignPut) return { method: "PUT", url: await driver.presignPut(key, contentType), headers: { "Content-Type": contentType } };
    return { method: "POST", url: null };
  }
}
