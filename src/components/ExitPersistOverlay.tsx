import {
  EXIT_PERSIST_PHASES,
  exitPersistCopy,
  type ExitPersistPhase,
} from "../core/exitPersist";

type ExitPersistOverlayProps = {
  phase: ExitPersistPhase;
};

export function ExitPersistOverlay({ phase }: ExitPersistOverlayProps) {
  const copy = exitPersistCopy(phase);
  const stepIndex = EXIT_PERSIST_PHASES.indexOf(phase) + 1;
  const stepTotal = EXIT_PERSIST_PHASES.length;

  return (
    <div
      className="exit-persist-overlay"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="exit-persist-title"
      aria-describedby="exit-persist-detail"
    >
      <div className="exit-persist-card">
        <p className="exit-persist-step" aria-hidden="true">
          Step {stepIndex} of {stepTotal}
        </p>
        <h2 id="exit-persist-title" className="exit-persist-title">
          {copy.title}
        </h2>
        <p id="exit-persist-detail" className="exit-persist-detail">
          {copy.detail}
        </p>
        <p className="exit-persist-hint">
          Mach saves session state on exit so your tabs, layout, and AI chats come back. This usually takes a moment.
        </p>
        <div className="exit-persist-progress" aria-hidden="true">
          <div className="exit-persist-progress-bar" />
        </div>
      </div>
    </div>
  );
}
