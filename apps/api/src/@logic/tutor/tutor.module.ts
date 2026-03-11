import { Module } from "@nestjs/common";
import { SharedAuthModule } from "@shared/shared-auth/shared-auth.module";
import { TutorService } from "./application/service/tutor.service";
import { TutorContract } from "./contract/tutor.contract";
import { TutorController } from "./presentation/controller/tutor.controller";

@Module({
  imports: [SharedAuthModule],
  controllers: [TutorController],
  providers: [TutorService, TutorContract],
  exports: [TutorContract],
})
export class TutorModule {}
