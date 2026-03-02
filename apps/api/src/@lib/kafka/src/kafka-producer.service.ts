import { Injectable } from "@nestjs/common";
import { KafkaClientService } from "./kafka-client.service";

@Injectable()
export class KafkaProducerService {
  constructor(private kafkaClient: KafkaClientService) {}

  async send(topic: string, payload: Record<string, unknown>) {
    await this.kafkaClient.getProducer().send({
      topic,
      messages: [
        {
          value: JSON.stringify(payload),
          timestamp: Date.now().toString(),
        },
      ],
    });
  }
}
