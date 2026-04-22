interface ProgressBarProps {
  value: number;   // 0..1
  className?: string;
  color?: string;
}

export function ProgressBar({ value, className, color }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={`progress-bar ${className ?? ""}`}>
      <i style={{ width: `${clamped * 100}%`, background: color }} />
    </div>
  );
}

export function ProgressTiny({ value, className, color }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={`progress-tiny ${className ?? ""}`}>
      <i style={{ width: `${clamped * 100}%`, background: color }} />
    </div>
  );
}
