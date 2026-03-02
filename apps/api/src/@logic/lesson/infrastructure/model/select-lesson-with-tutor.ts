import { SelectLesson } from "./select-lesson";
import { SelectTutor } from "../../../tutor/infrastructure/model/select-tutor";

export type SelectLessonWithTutor = {
  lessons: SelectLesson;
  tutors: SelectTutor;
};
