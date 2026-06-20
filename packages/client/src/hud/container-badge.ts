/** Etykieta odznaki kontenera Docker w panelu sesji: "🐳 <nazwa> · <obraz>". */
export function containerLabel(container: { id: string; name: string; image: string }): string {
  const base = `🐳 ${container.name}`;
  return container.image ? `${base} · ${container.image}` : base;
}
