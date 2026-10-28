import { Module } from "@nestjs/common";
import { AdminImagesController, MediaController } from "./images.controller";
import { ImagesService } from "./images.service";

@Module({
  controllers: [AdminImagesController, MediaController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
