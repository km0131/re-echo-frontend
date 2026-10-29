import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import AnswerPage from './routes/event/AnswerPage'
import DonePage from './routes/event/DonePage'
import EditPage from './routes/event/EditPage'
import EventPage from './routes/event/EventPage'
import AdminPage from './routes/admin/AdminPage'
import DashboardPage from './routes/admin/DashboardPage'
import LoginPage from './routes/admin/LoginPage'
import NewEventPage from './routes/admin/NewEventPage'
import SettingsPage from './routes/admin/SettingsPage'
import GalleryPage from './routes/gallery/GalleryPage'
import UploadPage from './routes/gallery/UploadPage'
import NotFound from './routes/NotFound'
import Root from './routes/Root'
import { PageSkeleton } from './ui'

// docs/spec.md 4章の全パス。未実装の画面は「準備中」。
const routes: RouteObject[] = [
  {
    element: <Root />,
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/e/:slug', element: <EventPage /> },
      { path: '/e/:slug/answer', element: <AnswerPage /> },
      { path: '/e/:slug/answer/done', element: <DonePage /> },
      { path: '/e/:slug/edit', element: <EditPage /> },
      { path: '/e/:slug/gallery', element: <GalleryPage /> },
      { path: '/e/:slug/gallery/upload', element: <UploadPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/events/new', element: <NewEventPage /> },
      { path: '/e/:slug/admin', element: <AdminPage /> },
      { path: '/e/:slug/admin/photos', element: <AdminPage /> },
      { path: '/settings', element: <SettingsPage /> },
      // 部品の見本（本番ビルドには含めない）
      ...(import.meta.env.DEV
        ? [{ path: '/dev/ui', lazy: () => import('./routes/DevUI').then((m) => ({ Component: m.default })) }]
        : []),
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
