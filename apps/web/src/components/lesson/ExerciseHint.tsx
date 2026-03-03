interface ExerciseHintProps {
  hint?: string;
}

export function ExerciseHint({ hint }: ExerciseHintProps) {
  if (!hint) return null;
  return <p className="text-sm text-gray-400 mb-3">Hint: {hint}</p>;
}
