export interface KafkaMessage<T = Record<string, unknown>> {
  topic: string;
  payload: T;
  timestamp: number;
}
