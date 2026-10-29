import { Outlet, ScrollRestoration } from 'react-router'
import { ApiStatusBanner } from '../components/ApiStatusBanner'

export default function Root() {
  return (
    <>
      <ApiStatusBanner />
      <Outlet />
      <ScrollRestoration />
    </>
  )
}
