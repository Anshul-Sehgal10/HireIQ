export default function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return <div className="h-4" />;

  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="flex h-4 items-center gap-2 px-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "120ms" }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "240ms" }} />
      </span>
      {text}
    </div>
  );
}