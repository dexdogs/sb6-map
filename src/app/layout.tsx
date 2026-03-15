import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The SB-6 Map — Texas AI Data Centers & BESS',
  description: 'Every Texas data center connecting to ERCOT in 2026 faces SB-6. This map shows who\'s exposed, the solar resource, and what battery storage does about it.',
  openGraph: {
    title: 'The SB-6 Map',
    description: 'Texas passed a law. Every new AI data center must now have emergency shutoff or on-site power. Here\'s the map.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
