import { Suspense } from 'react'
import { PerformanceMonitor } from '@react-three/drei'
import { Blast, Landing } from '@/cinematic/Blast'
import { transient } from '@/state/transient'
import { useThemeName } from '@/config/theme'
import { Car } from '@/car/Car'
import { Lighting, StudioEnvironment } from './Lighting'
import { Stage } from './Stage'
import { RaceTrack } from './RaceTrack'
import { Showroom } from './Showroom'
import { Warmup } from './Warmup'
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
      <Showroom theme={theme} />
      <RaceTrack />
      <Blast />
      <Landing />
      {/* low-end GPUs: fewer particles and raymarch steps in the blast */}
      <PerformanceMonitor onDecline={() => { transient.quality = 0.5 }} onIncline={() => { transient.quality = 1 }} />
      <Suspense fallback={null}>
        <Car />
      </Suspense>
      <LabelProjector />
      <Effects />
      <Warmup />
    </>
  )
}
