import { Outlet, ScrollRestoration } from 'react-router'
import { ApiStatusBanner } from '../components/ApiStatusBanner'
import { ToastProvider } from '../ui'

export default function Root() {
  return (
    <ToastProvider>
      <ApiStatusBanner />
      <Outlet />
      <ScrollRestoration />
    </ToastProvider>
  )
}
