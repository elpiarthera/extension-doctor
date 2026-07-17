// FIXTURE PROVENANCE: verbatim copy of ui/components/media/MediaCardShell.tsx
// from gptpowerups-extension @ origin/chi/d137-baseline-green (dynamic t(`...`) key, cas tordu #1)

/**
 * MediaCardShell — outer card wrapper: role="button", drag, keyboard, aria.
 * T4 D92 decomposition from MediaCard.tsx.
 */
import type { ComponentChildren, JSX } from "preact";
import { t } from "../../../src/core/i18n";
import type { Media } from "../../../src/core/media-store/types";

export interface MediaCardShellProps {
  media: Media;
  viewMode: "grid" | "list";
  hovered: boolean;
  focused: boolean;
  onClick: (e: MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children: ComponentChildren;
}

export function MediaCardShell({
  media,
  viewMode,
  hovered,
  focused,
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  children,
}: MediaCardShellProps): JSX.Element {
  const isGrid = viewMode === "grid";
  const cardStyle: JSX.CSSProperties = {
    display: "flex",
    flexDirection: isGrid ? "column" : "row",
    alignItems: isGrid ? "stretch" : "center",
    gap: isGrid ? "0" : "12px",
    borderRadius: "var(--radius-md, 8px)",
    border: `1px solid ${hovered || focused ? "var(--gptu-border-hover, var(--gptu-ring))" : "var(--gptu-border)"}`,
    background: hovered ? "var(--gptu-muted)" : "var(--gptu-bg)",
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 100ms, background 100ms",
    position: "relative",
    padding: isGrid ? "0" : "10px 12px",
    outline: focused ? "2px solid var(--gptu-ring)" : "none",
    outlineOffset: "2px",
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: outer card must be div to allow nested interactive buttons
    <div
      role="button"
      tabIndex={0}
      data-testid={`media-card-${media.id}`}
      style={cardStyle}
      draggable={true}
      onDragStart={(e) => {
        (e as DragEvent).dataTransfer?.setData("text/plain", media.id);
        (e as DragEvent).dataTransfer?.setData("text/gptu-media-id", media.id);
        e.stopPropagation();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick as JSX.MouseEventHandler<HTMLDivElement>}
      onKeyDown={onKeyDown as JSX.KeyboardEventHandler<HTMLDivElement>}
      aria-label={`${media.title} — ${t(`media_type_${media.type}`)}`}
    >
      {children}
    </div>
  );
}
