interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onRetry, className = "" }: ErrorMessageProps) {
  return (
    <div className={`card py-8 text-center ${className}`}>
      <p className="mb-2 font-medium text-red-500">Something went wrong</p>
      <p className="mb-4 text-sm text-gray-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary px-6 py-2 text-sm"
        >
          Try again
        </button>
      )}
    </div>
  );
}
