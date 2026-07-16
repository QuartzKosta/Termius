// Cache-busting: append a version query param so the browser always fetches
// the latest dnd-console.html instead of serving a stale cached version.
// Bump this version when you ship changes to dnd-console.html.
const CONSOLE_VERSION = "2026-07-16-puzzles-v1";

export default function Home() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      <iframe
        src={`/dnd-console.html?v=${CONSOLE_VERSION}`}
        title="Ashen Codex — D&D Campaign Console"
        className="w-full h-full border-0 block"
        allow="autoplay"
      />
    </div>
  )
}
