import { Module } from "@nestjs/common";
import { KafkaClientService } from "./kafka-client.service";
import { KafkaProducerService } from "./kafka-producer.service";

@Module({
  providers: [KafkaClientService, KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
