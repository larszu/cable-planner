const NAV_EVENT = "docs:navigate";

export function navigateTo(path: string) {
  window.history.pushState({}, "", "/" + path);
  window.dispatchEvent(new CustomEvent(NAV_EVENT));
}

export function getPath() {
  return window.location.pathname.replace(/^\//, "");
}

export function onNavigate(callback: () => void): () => void {
  // Listen for both our custom event (link clicks) and popstate (back/forward)
  window.addEventListener(NAV_EVENT, callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener(NAV_EVENT, callback);
    window.removeEventListener("popstate", callback);
  };
}
