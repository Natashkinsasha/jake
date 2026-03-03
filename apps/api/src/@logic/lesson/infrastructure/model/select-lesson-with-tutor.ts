import { SelectLesson } from "./select-lesson";
import { TutorEntity } from "../../../tutor/domain/entity/tutor.entity";

export type SelectLessonWithTutor = {
  lessons: SelectLesson;
  tutors: TutorEntity;
};
