export function etfDeepLink(id) {
  return `?code=${encodeURIComponent(id)}`;
}

export function handleEtfLinkClick(event, id, onOpenEtf) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) {
    return;
  }
  event.preventDefault();
  onOpenEtf(id);
}
