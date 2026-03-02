import { Injectable } from "@nestjs/common";
import { BaseKafkaConsumer } from "../../../../@lib/kafka/src/base-kafka.consumer";
import { KafkaClientService } from "../../../../@lib/kafka/src/kafka-client.service";

@Injectable()
export class LessonCompletedConsumer extends BaseKafkaConsumer {
  constructor(kafkaClient: KafkaClientService) {
    super(kafkaClient, "lesson-analytics", "lesson.completed");
  }

  async handle(payload: Record<string, unknown>): Promise<void> {
    // Analytics, notifications, etc.
    console.log("Lesson completed event:", payload);
  }
}
