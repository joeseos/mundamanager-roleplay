import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Munda Manager Roleplay</h1>
      <p className="mt-2 text-stone-300">
        Companion app for Venators and their Arbitrator.
      </p>
    </main>
  )
}
