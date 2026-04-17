import { PageLoading } from '@/components/feedback/page-loading'

/**
 * Default Suspense fallback for every route under `app/`.
 * Renders while server components stream in.
 * Individual routes can override by dropping their own `loading.tsx`.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6">
      <PageLoading />
    </div>
  )
}
