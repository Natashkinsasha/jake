export type TutorGender = "male" | "female";
export type TutorNationality = "australian" | "british" | "scottish" | "american";

export interface TutorProfile {
  gender: TutorGender;
  nationality: TutorNationality;
  description: string;
  traits: string[];
  promptFragment: string;
}

export interface TutorVoice {
  id: string;
  name: string;
  gender: TutorGender;
}
