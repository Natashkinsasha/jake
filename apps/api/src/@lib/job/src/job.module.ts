import { Module } from "@nestjs/common";
import { QueueRegistryService } from "./queue-registry.service";

@Module({
  providers: [QueueRegistryService],
  exports: [QueueRegistryService],
})
export class JobModule {}
