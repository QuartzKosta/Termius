export default function Home() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      <iframe
        src="/dnd-console.html"
        title="Ashen Codex — D&D Campaign Console"
        className="w-full h-full border-0 block"
        allow="autoplay"
      />
    </div>
  )
}
