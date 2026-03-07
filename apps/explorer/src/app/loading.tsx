export default function Loading() {
  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center min-h-screen px-4 hero-grain hero-glow">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-algo-teal text-glow">
            <span className="font-mono">VibeKit</span> Explorer
          </h1>
          <p className="text-algo-muted/80 max-w-md mx-auto">The Agentic Explorer for Algorand</p>
        </div>
      </div>
    </div>
  )
}
