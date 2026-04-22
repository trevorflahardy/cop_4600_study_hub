import clsx from "clsx";

export type PipState = "pending" | "done" | "now" | "wrong" | "review";

export function Pip({ state = "pending" }: { state?: PipState }) {
  return <span className={clsx("pip", state !== "pending" && state)} />;
}

export function PipRow({ states }: { states: PipState[] }) {
  return (
    <div className="pip-row">
      {states.map((s, i) => (
        <Pip key={i} state={s} />
      ))}
    </div>
  );
}
