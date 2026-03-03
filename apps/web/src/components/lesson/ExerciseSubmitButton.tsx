interface ExerciseSubmitButtonProps {
  disabled: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
}

export function ExerciseSubmitButton({
  disabled,
  onClick,
  label = "Check",
  className = "",
}: ExerciseSubmitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-primary w-full ${className}`}
    >
      {label}
    </button>
  );
}
