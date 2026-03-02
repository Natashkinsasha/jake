import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, Producer, Consumer } from "kafkajs";
import { EnvService } from "../../../@shared/shared-config/env.service";

@Injectable()
export class KafkaClientService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;

  constructor(private env: EnvService) {
    this.kafka = new Kafka({
      clientId: "jake-api",
      brokers: env.get("KAFKA_BROKERS").split(","),
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  getProducer(): Producer {
    return this.producer;
  }

  createConsumer(groupId: string): Consumer {
    return this.kafka.consumer({ groupId });
  }
}
