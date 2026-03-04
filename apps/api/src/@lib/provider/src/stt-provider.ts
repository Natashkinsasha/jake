export abstract class SttProvider {
  abstract transcribe(audioBase64: string): Promise<string>;
}
