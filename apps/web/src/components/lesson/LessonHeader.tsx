interface LessonHeaderProps {
  children?: React.ReactNode;
}

export function LessonHeader({ children }: LessonHeaderProps) {
  return (
    <div className="pt-safe-extra flex shrink-0 items-center justify-end px-4 pb-1">
      {children}
    </div>
  );
}
