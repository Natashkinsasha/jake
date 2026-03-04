export abstract class TtsProvider {
  abstract synthesize(text: string, voiceId: string, speed?: number): Promise<string>;
}
