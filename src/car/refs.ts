import type * as THREE from 'three'

/** Shared refs for systems outside the car (tap raycast, label projection). Sub-assemblies register here too. */
export const carRefs = {
  car: null as THREE.Group | null,
  parts: {} as Record<string, THREE.Object3D>,
}
