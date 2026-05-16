export function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Click handler for internal links — prevents default and uses pushState.
 * Usage: <a href="/foo" onClick={linkClick}>
 */
export function linkClick(e: React.MouseEvent<HTMLAnchorElement>) {
  // Let modified clicks (ctrl, meta, shift) behave normally (open in new tab etc.)
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const href = e.currentTarget.getAttribute("href");
  if (href) navigateTo(href);
}
