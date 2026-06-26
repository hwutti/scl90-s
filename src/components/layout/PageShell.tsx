import { Navbar } from './Navbar'

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pt-14 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </>
  )
}
