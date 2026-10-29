import { lazy, Suspense } from 'react'

const Spline = lazy(() => import('@splinetool/react-spline'))

/**
 * Interactive 3D layer. Renders only when VITE_SPLINE_SCENE is set to a
 * published Spline scene URL (https://prod.spline.design/<id>/scene.splinecode).
 * The runtime is code-split, so it never costs the initial page load.
 */
export function SplineHero({ className }: { className?: string }) {
  const scene = import.meta.env.VITE_SPLINE_SCENE as string | undefined
  if (!scene) return null
  return (
    <div className={className}>
      <Suspense fallback={null}>
        <Spline scene={scene} />
      </Suspense>
    </div>
  )
}
