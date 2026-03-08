interface LessonHeaderProps {
  children?: React.ReactNode;
}

export function LessonHeader({ children }: LessonHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-end px-4 pb-1 pt-safe-extra">
      {children}
    </div>
  );
}
