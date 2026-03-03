"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useApiQuery } from "@/hooks/useApiQuery";

export default function HomeworkDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: homework, isLoading, error, refetch } = useApiQuery(
    () => api.homework.get(id),
    [id],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!homework) return;
    await api.homework.submit(homework.id, answers);
    setSubmitted(true);
  };

  if (isLoading) return <LoadingSpinner className="h-64" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!homework) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Homework</h1>
      <p className="text-gray-500 mb-6">
        Created {new Date(homework.createdAt).toLocaleDateString()}
      </p>

      {submitted || homework.completedAt ? (
        <div className="card text-center">
          <span className="text-5xl mb-3 block">🎉</span>
          <h2 className="text-xl font-semibold text-gray-900">Homework completed!</h2>
          {homework.score !== null && (
            <p className="text-gray-500 mt-2">Score: {homework.score}%</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {homework.exercises.map((exercise, i) => (
            <div key={i} className="card">
              <p className="text-sm font-medium text-primary-600 mb-2">
                Question {i + 1}
              </p>
              <p className="text-gray-900 mb-3">{exercise.question || exercise.sentence}</p>
              <input
                type="text"
                value={answers[String(i)] || ""}
                onChange={(e) => setAnswers({ ...answers, [String(i)]: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:border-primary-400 outline-none"
                placeholder="Your answer..."
              />
            </div>
          ))}
          <button onClick={handleSubmit} className="btn-primary w-full">
            Submit Homework
          </button>
        </div>
      )}
    </div>
  );
}
