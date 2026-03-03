import Link from "next/link";
import { formatLessonDate } from "@/lib/utils";

interface HomeworkCardProps {
  id: string;
  lessonDate: string;
  exerciseCount: number;
  score: number | null;
  completedAt: string | null;
}

export function HomeworkCard({ id, lessonDate, exerciseCount, score, completedAt }: HomeworkCardProps) {
  const isCompleted = !!completedAt;

  return (
    <Link href={`/homework/${id}`}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              Homework from {formatLessonDate(lessonDate)}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-right">
            {isCompleted ? (
              <div>
                <span className="inline-block text-xs font-medium text-green-600 bg-green-50 rounded-full px-2.5 py-0.5">
                  Done
                </span>
                {score !== null && (
                  <p className="text-sm text-gray-500 mt-1">{score}%</p>
                )}
              </div>
            ) : (
              <span className="inline-block text-xs font-medium text-orange-600 bg-orange-50 rounded-full px-2.5 py-0.5">
                Pending
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
