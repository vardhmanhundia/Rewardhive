interface Props {
  memories: string[];
}

export const MemoriesNote = ({ memories }: Props) => {
  if (memories.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Noted about you:</span>
      {memories.map((m) => (
        <span
          key={m}
          className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
        >
          {m}
        </span>
      ))}
    </div>
  );
};
