import { useEffect, useMemo, useState } from "react";
import { filterPaletteCommands } from "../core/palette";

export interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  description?: string;
}

interface CommandPaletteProps {
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
  onRun: (commandId: string) => void;
}

export interface PaletteKeyDecision {
  preventDefault: boolean;
  nextActiveIndex: number;
  shouldRunSelection: boolean;
  shouldClose: boolean;
}

export function decidePaletteKeyAction(args: {
  key: string;
  activeIndex: number;
  filteredCount: number;
  hasSelection: boolean;
}): PaletteKeyDecision | null {
  const { key, activeIndex, filteredCount, hasSelection } = args;
  if (key === "ArrowDown") {
    if (filteredCount === 0) {
      return {
        preventDefault: true,
        nextActiveIndex: activeIndex,
        shouldRunSelection: false,
        shouldClose: false,
      };
    }
    return {
      preventDefault: true,
      nextActiveIndex: (activeIndex + 1) % filteredCount,
      shouldRunSelection: false,
      shouldClose: false,
    };
  }
  if (key === "ArrowUp") {
    if (filteredCount === 0) {
      return {
        preventDefault: true,
        nextActiveIndex: activeIndex,
        shouldRunSelection: false,
        shouldClose: false,
      };
    }
    return {
      preventDefault: true,
      nextActiveIndex: (activeIndex - 1 + filteredCount) % filteredCount,
      shouldRunSelection: false,
      shouldClose: false,
    };
  }
  if (key === "Enter") {
    return {
      preventDefault: true,
      nextActiveIndex: activeIndex,
      shouldRunSelection: hasSelection,
      shouldClose: hasSelection,
    };
  }
  if (key === "Escape") {
    return {
      preventDefault: true,
      nextActiveIndex: activeIndex,
      shouldRunSelection: false,
      shouldClose: true,
    };
  }
  return null;
}

export function CommandPalette({ open, commands, onClose, onRun }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const ranked = useMemo(() => filterPaletteCommands(commands, query), [commands, query]);
  const filtered = ranked.map((entry) => entry.command);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    setActiveIndex(0);
  }, [open, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette-panel" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder="Type a command..."
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            const decision = decidePaletteKeyAction({
              key: event.key,
              activeIndex,
              filteredCount: filtered.length,
              hasSelection: Boolean(filtered[activeIndex]),
            });
            if (!decision) {
              return;
            }
            if (decision.preventDefault) {
              event.preventDefault();
            }
            if (decision.nextActiveIndex !== activeIndex) {
              setActiveIndex(decision.nextActiveIndex);
            }
            if (decision.shouldRunSelection) {
              const selected = filtered[activeIndex];
              if (selected) {
                onRun(selected.id);
              }
            }
            if (decision.shouldClose) {
              onClose();
            }
          }}
        />
        <div className="palette-results">
          {filtered.length === 0 ? (
            <p className="palette-empty">No commands match your query.</p>
          ) : (
            filtered.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={`palette-item ${index === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onRun(command.id);
                  onClose();
                }}
              >
                <span>
                  {command.label}
                  {command.description ? <small className="palette-item-description">{command.description}</small> : null}
                </span>
                {command.shortcut ? <small>{command.shortcut}</small> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
