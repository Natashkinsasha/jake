import { Global, Module } from "@nestjs/common";
import { KafkaClientService } from "../../@lib/kafka/src/kafka-client.service";
import { KafkaProducerService } from "../../@lib/kafka/src/kafka-producer.service";

@Global()
@Module({
  providers: [KafkaClientService, KafkaProducerService],
  exports: [KafkaProducerService],
})
export class SharedKafkaModule {}
