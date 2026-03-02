import { z } from "zod";

export const wsAudioMessageSchema = z.object({
  audio: z.string().min(1),
});

export interface WsAudioMessage {
  audio: string;
}
