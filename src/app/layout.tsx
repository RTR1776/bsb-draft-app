import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BSB Draft Command Center',
  description: 'Box Score Baseball KDS Draft Strategy & Live Draft Tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
