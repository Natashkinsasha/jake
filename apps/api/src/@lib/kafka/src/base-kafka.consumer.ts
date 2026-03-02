import { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Consumer } from "kafkajs";
import { KafkaClientService } from "./kafka-client.service";

export abstract class BaseKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  protected consumer: Consumer;

  constructor(
    protected kafkaClient: KafkaClientService,
    protected groupId: string,
    protected topic: string,
  ) {
    this.consumer = this.kafkaClient.createConsumer(this.groupId);
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const payload = JSON.parse(message.value?.toString() || "{}");
        await this.handle(payload);
      },
    });
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  abstract handle(payload: Record<string, unknown>): Promise<void>;
}
