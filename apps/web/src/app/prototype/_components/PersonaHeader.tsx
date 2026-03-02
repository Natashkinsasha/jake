interface PersonaHeaderProps {
  letter: string;
  name: string;
  status: string;
  accentColor: string;
}

export function PersonaHeader({
  letter,
  name,
  status,
  accentColor,
}: PersonaHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`w-10 h-10 rounded-full ${accentColor} flex items-center justify-center text-lg`}
      >
        {letter}
      </div>
      <div>
        <h2 className="font-semibold text-lg">{name}</h2>
        <p className="text-sm text-gray-500">{status}</p>
      </div>
    </div>
  );
}
