import type { Metadata } from 'next'
import { Source_Sans_3 } from 'next/font/google'
import { ToastContainer } from 'react-toastify'
import { TooltipProvider } from '@/components/ui/tooltip'
import 'react-toastify/ReactToastify.css'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-source-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Push Notification Tool',
  description: 'STAG-only console for composing Auto App Push notifications',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sourceSans.variable}>
      <body>
        {/* One provider for every tooltip, so moving between two of them skips the open delay. */}
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        {/* Rendered once for the whole app. `globals.css` restyles it with the design tokens. */}
        <ToastContainer position="top-right" newestOnTop closeOnClick={false} draggable={false} theme="light" />
      </body>
    </html>
  )
}
