// Renders a description string with **highlighted** words shown in the accent
// color. Keeps the data model plain text (works in JSON manifests too) while
// preserving the colored-emphasis look of the original hand-written cards.
export function renderText(text, accent) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} style={{ color: accent }}>
          {part.slice(2, -2)}
        </span>
      );
    }
    return part;
  });
}
