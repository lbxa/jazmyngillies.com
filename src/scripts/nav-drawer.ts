type Teardown = () => void;

/**
 * Drives the off-canvas navigation. The movement itself is CSS -- this only
 * flips `data-nav-open` on <body> and keeps the accessible state in step with
 * it.
 */
export const initNavDrawer = (): Teardown => {
  const toggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const drawer = document.querySelector<HTMLElement>("[data-nav-drawer]");
  const shell = document.querySelector<HTMLElement>("[data-site-shell]");

  if (!toggle || !drawer) {
    return () => undefined;
  }

  const disposers: Array<() => void> = [];
  let isOpen = false;

  // The mobile drawer is sized by its content, but the shell moves by a
  // transform, which needs a length. Publish the measured height so the two
  // stay in step -- including when the viewport changes and the links reflow.
  const publishDrawerHeight = () => {
    const { height } = drawer.getBoundingClientRect();

    document.documentElement.style.setProperty(
      "--drawer-height",
      `${Math.ceil(height)}px`,
    );
  };

  const setOpen = (open: boolean, returnFocus = true) => {
    if (open === isOpen) {
      return;
    }

    isOpen = open;
    document.body.toggleAttribute("data-nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    // While closed the drawer is merely covered by the shell, not hidden, so it
    // would otherwise stay in the tab order and the accessibility tree.
    drawer.toggleAttribute("inert", !open);

    if (open) {
      drawer.querySelector<HTMLAnchorElement>("a")?.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  };

  const handleToggle = () => setOpen(!isOpen);

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen) {
      setOpen(false);
    }
  };

  // With the menu open the shell is just a large slab of pushed-aside page;
  // clicking it should dismiss rather than interact. Capture phase so the click
  // never reaches the carousel triggers underneath.
  const handleShellClick = (event: Event) => {
    if (!isOpen) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  };

  const handleDrawerClick = (event: Event) => {
    if ((event.target as HTMLElement).closest("a")) {
      setOpen(false, false);
    }
  };

  publishDrawerHeight();

  const resizeObserver = new ResizeObserver(publishDrawerHeight);
  resizeObserver.observe(drawer);
  disposers.push(() => resizeObserver.disconnect());

  toggle.addEventListener("click", handleToggle);
  document.addEventListener("keydown", handleKeydown);
  drawer.addEventListener("click", handleDrawerClick);
  shell?.addEventListener("click", handleShellClick, true);

  disposers.push(
    () => toggle.removeEventListener("click", handleToggle),
    () => document.removeEventListener("keydown", handleKeydown),
    () => drawer.removeEventListener("click", handleDrawerClick),
    () => shell?.removeEventListener("click", handleShellClick, true),
  );

  return () => {
    for (const dispose of disposers) {
      dispose();
    }

    setOpen(false, false);
  };
};
