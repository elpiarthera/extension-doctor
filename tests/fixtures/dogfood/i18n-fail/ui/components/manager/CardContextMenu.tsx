// FIXTURE PROVENANCE: verbatim copy of ui/components/manager/CardContextMenu.tsx
// from gptpowerups-extension @ origin/chi/d137-rebuild-zip-v0.9.0.0

/**
 * CardContextMenu — 3-dot context menu. Bug C fix pattern: second submenuRef.
 * Portal pattern: submenu via createPortal. All hooks before conditional returns.
 * Extracted from Card.tsx — D92-T5.
 */
import type { JSX, RefObject } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../../src/core/i18n";
import type { Prompt } from "../../../src/core/prompts-store";
import type { Project } from "../../../src/stores/projects/types";
import { Z } from "../../z-index";
import { CardChevronRightIcon, DotsIcon } from "./CardIcons";

export interface CardContextMenuProps {
  prompt: Prompt;
  onEdit?: ((p: Prompt) => void) | undefined;
  onDelete?: ((p: Prompt) => void) | undefined;
  onDuplicate?: ((p: Prompt) => void) | undefined;
  onFavorite?: ((p: Prompt) => void) | undefined;
  projects?: Project[] | undefined;
  onProjectToggle?: ((promptId: string, projectId: string, action: "add" | "remove") => void) | undefined;
}

const itemStyle: JSX.CSSProperties = {
  padding: "7px 10px", borderRadius: "6px", border: "none", background: "transparent",
  color: "var(--gptu-fg)", cursor: "pointer", fontSize: "0.8125rem", textAlign: "left", width: "100%", transition: "background 80ms",
};

export function CardContextMenu({ prompt, onEdit, onDelete, onDuplicate, onFavorite, projects, onProjectToggle }: CardContextMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuCoords, setSubmenuCoords] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null) as RefObject<HTMLButtonElement>;
  const menuRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const submenuRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable, .current changes are not deps
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent): void {
      const target = e.target as Node;
      if (!(menuRef.current?.contains(target) ?? false) && !(btnRef.current?.contains(target) ?? false) && !(submenuRef.current?.contains(target) ?? false)) {
        setOpen(false); setSubmenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  if (!onEdit && !onDelete && !onDuplicate && !onFavorite) return <></>;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t("card_menu_open")}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`card-menu-btn-${prompt.id}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); if (submenuOpen) setSubmenuOpen(false); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", border: "none", background: "transparent", color: "var(--gptu-muted-fg)", cursor: "pointer", padding: "0" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--gptu-muted)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--gptu-fg)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--gptu-muted-fg)"; }}
      >
        <DotsIcon />
      </button>

      {open && (
        <div ref={menuRef} role="menu" data-testid={`card-menu-${prompt.id}`}
          style={{ position: "absolute", top: "calc(100% + 4px)", right: "0", zIndex: Z.contextMenu, minWidth: "160px", background: "var(--gptu-surface)", border: "1px solid var(--gptu-border)", borderRadius: "8px", boxShadow: "0 8px 24px oklch(0% 0 0 / 0.2)", padding: "4px", display: "flex", flexDirection: "column", gap: "1px" }}
        >
          {onEdit && <button type="button" role="menuitem" data-testid={`card-menu-edit-${prompt.id}`} onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(prompt); }} style={itemStyle}>{t("edit")}</button>}
          {onDuplicate && <button type="button" role="menuitem" data-testid={`card-menu-duplicate-${prompt.id}`} onClick={(e) => { e.stopPropagation(); setOpen(false); onDuplicate(prompt); }} style={itemStyle}>{t("duplicate")}</button>}
          {onFavorite && <button type="button" role="menuitem" data-testid={`card-menu-favorite-${prompt.id}`} onClick={(e) => { e.stopPropagation(); setOpen(false); onFavorite(prompt); }} style={itemStyle}>{prompt.favorite ? t("unfavorite") : t("favorite")}</button>}
          {projects && projects.length > 0 && onProjectToggle && (
            // biome-ignore lint/a11y/useFocusableInteractive: submenu trigger; keyboard via Tab to submenu buttons
            <div role="menuitem" aria-haspopup="menu" data-testid={`card-menu-projects-${prompt.id}`}
              onMouseEnter={(e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setSubmenuCoords({ x: rect.right + 4, y: rect.top }); setSubmenuOpen(true); }}
              onMouseLeave={() => setSubmenuOpen(false)}
              style={{ ...itemStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span>{t("move_to_project")}</span>
              <CardChevronRightIcon />
            </div>
          )}
          {onDelete && (
            <>
              <div style={{ height: "1px", background: "var(--gptu-border)", margin: "2px 0" }} />
              <button type="button" role="menuitem" data-testid={`card-menu-delete-${prompt.id}`} onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(prompt); }} style={{ ...itemStyle, color: "var(--destructive, oklch(60% 0.2 25))" }}>{t("delete")}</button>
            </>
          )}
        </div>
      )}

      {submenuOpen && projects && onProjectToggle && createPortal(
        <div ref={submenuRef} role="menu" data-testid={`card-submenu-projects-${prompt.id}`}
          onMouseEnter={() => setSubmenuOpen(true)} onMouseLeave={() => setSubmenuOpen(false)}
          style={{ position: "fixed", top: submenuCoords.y, left: submenuCoords.x, zIndex: Z.contextMenu + 1, minWidth: "160px", background: "var(--gptu-surface)", border: "1px solid var(--gptu-border)", borderRadius: "8px", boxShadow: "0 8px 24px oklch(0% 0 0 / 0.2)", padding: "4px", display: "flex", flexDirection: "column", gap: "1px" }}
        >
          {projects.map((project) => {
            const isMember = (prompt.projectIds ?? []).includes(project.id);
            return (
              <button key={project.id} type="button" role="menuitem" data-testid={`card-submenu-project-${project.id}`}
                onClick={(e) => { e.stopPropagation(); setSubmenuOpen(false); setOpen(false); onProjectToggle(prompt.id, project.id, isMember ? "remove" : "add"); }}
                style={{ ...itemStyle, fontWeight: isMember ? "600" : "400", color: isMember ? "var(--gptu-primary)" : "var(--gptu-fg)" }}
              >
                {project.name}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
