interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onRetry, className = "" }: ErrorMessageProps) {
  return (
    <div className={`card text-center py-8 ${className}`}>
      <p className="text-red-500 font-medium mb-2">Something went wrong</p>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary text-sm px-6 py-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}
