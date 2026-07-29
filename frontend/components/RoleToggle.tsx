"use client";

interface Props {
  value: "candidate" | "employer";
  onChange: (value: "candidate" | "employer") => void;
  disabled?: boolean;
}

export default function RoleToggle({ value, onChange, disabled }: Props) {
  return (
    <div className="relative grid grid-cols-2 rounded-lg border border-border bg-muted/50 p-1 text-sm font-medium">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-300 ease-out"
        style={{ transform: value === "candidate" ? "translateX(0%)" : "translateX(100%)" }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("candidate")}
        className={`relative z-10 rounded-md py-2 transition-colors disabled:cursor-not-allowed ${
          value === "candidate" ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        Candidate
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("employer")}
        className={`relative z-10 rounded-md py-2 transition-colors disabled:cursor-not-allowed ${
          value === "employer" ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        Employer
      </button>
    </div>
  );
}