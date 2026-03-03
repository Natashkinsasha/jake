import type { Exercise } from "@jake/shared";

export interface WsTutorMessage {
  text: string;
  audio: string;
  exercise: Exercise | null;
}
