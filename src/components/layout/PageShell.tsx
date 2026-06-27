export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {children}
    </div>
  )
}
