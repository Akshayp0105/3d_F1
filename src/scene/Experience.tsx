import { Suspense } from 'react'
import { useThemeName } from '@/config/theme'
import { Car } from '@/car/Car'
import { Lighting, StudioEnvironment } from './Lighting'
import { Stage } from './Stage'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { ExplodeDriver, LabelProjector } from './SceneSystems'
import { CinematicDirector } from '@/cinematic/CinematicDirector'

export function Experience() {
  const theme = useThemeName()
  return (
    <>
      <CinematicDirector />
      <CameraRig />
      <ExplodeDriver />
      <Lighting />
      <StudioEnvironment theme={theme} />
      <Stage theme={theme} />
      <Suspense fallback={null}>
        <Car />
      </Suspense>
      <LabelProjector />
      <Effects />
    </>
  )
}
