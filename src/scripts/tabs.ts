type Teardown = () => void;

/**
 * Drives an ARIA tabs widget.
 *
 * Roving tabindex rather than leaving every tab tabbable: the tablist is a
 * single stop in the page's tab order, and the arrow keys move between tabs
 * inside it. That is what the pattern expects, and it stops a long tab row from
 * burying the panel behind a dozen presses of Tab.
 */
export const initTabs = (
  root: HTMLElement,
  onChange?: (panel: HTMLElement | null) => void,
): Teardown => {
  const tabs = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );

  if (tabs.length === 0) {
    return () => undefined;
  }

  const panelOf = (tab: HTMLButtonElement) =>
    document.getElementById(tab.getAttribute("aria-controls") ?? "");

  const select = (next: HTMLButtonElement, moveFocus: boolean) => {
    for (const tab of tabs) {
      const isSelected = tab === next;

      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      panelOf(tab)?.toggleAttribute("hidden", !isSelected);
    }

    if (moveFocus) {
      next.focus();
    }

    onChange?.(panelOf(next));
  };

  const handleClick = (event: Event) => {
    select(event.currentTarget as HTMLButtonElement, false);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const current = tabs.indexOf(event.currentTarget as HTMLButtonElement);

    const nextIndex = {
      ArrowRight: (current + 1) % tabs.length,
      ArrowLeft: (current - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];

    if (nextIndex === undefined) {
      return;
    }

    // Left/Right would otherwise scroll the panel underneath the tablist.
    event.preventDefault();
    select(tabs[nextIndex], true);
  };

  for (const tab of tabs) {
    tab.addEventListener("click", handleClick);
    tab.addEventListener("keydown", handleKeydown);
  }

  return () => {
    for (const tab of tabs) {
      tab.removeEventListener("click", handleClick);
      tab.removeEventListener("keydown", handleKeydown);
    }
  };
};
