// Car material set. The STL has no UVs, so livery zones and carbon weave are computed from object-space
// position/normal in the shader (body parts are authored in car space, wheels in axle space).
import * as THREE from 'three'
import type { Livery } from '@/config/liveries'
import { carbonTex, finTex } from './textures'

const OBJ_VARYINGS_VS = (sh: { vertexShader: string }) => {
  sh.vertexShader =
    'varying vec3 vObjPos;\nvarying vec3 vObjN;\n' +
    sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vObjN = objectNormal;')
}
const OBJ_VARYINGS_FS = 'varying vec3 vObjPos;\nvarying vec3 vObjN;\n'

export function createCarMaterials() {
  const U = {
    base: { value: new THREE.Color() },
    accent: { value: new THREE.Color() },
    accent2: { value: new THREE.Color() },
    carbon: { value: carbonTex() },
    carbonScale: { value: 7.5 },
  }

  /** Livery paint: matte base, yellow nose tip, darker lower bodywork, dark inner faces on cut shells. */
  const paint = new THREE.MeshPhysicalMaterial({ metalness: 0.18, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 0.75, side: THREE.DoubleSide })
  paint.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uBase: U.base, uAccent: U.accent, uAccent2: U.accent2 })
    OBJ_VARYINGS_VS(sh)
    sh.fragmentShader =
      'uniform vec3 uBase;\nuniform vec3 uAccent;\nuniform vec3 uAccent2;\n' + OBJ_VARYINGS_FS +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vObjPos;
        float aa = 0.006;
        float nose = smoothstep(2.50 - aa, 2.50 + aa, p.x) * (1.0 - smoothstep(0.17, 0.2, abs(p.z)));
        vec3 col = mix(uBase, uAccent2, nose);
        col *= mix(0.55, 1.0, smoothstep(0.12, 0.26, p.y));
        if (!gl_FrontFacing) col *= 0.22;
        diffuseColor.rgb = col;`,
      )
  }

  /** Bare carbon with a triplanar weave. */
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.6, side: THREE.DoubleSide })
  carbon.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uCarbon: U.carbon, uCarbonScale: U.carbonScale })
    OBJ_VARYINGS_VS(sh)
    sh.fragmentShader =
      'uniform sampler2D uCarbon;\nuniform float uCarbonScale;\n' + OBJ_VARYINGS_FS +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 bw = pow(abs(normalize(vObjN)), vec3(4.0));
        bw /= (bw.x + bw.y + bw.z);
        vec3 cp = vObjPos * uCarbonScale;
        vec3 weave = texture2D(uCarbon, cp.zy).rgb * bw.x + texture2D(uCarbon, cp.xz).rgb * bw.y + texture2D(uCarbon, cp.xy).rgb * bw.z;
        diffuseColor.rgb *= weave * (gl_FrontFacing ? 1.0 : 0.5);`,
      )
  }

  /** Tyre rubber with a red (soft compound) sidewall ring, in axle space. */
  const tyre = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0b0c0d'), roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
  tyre.onBeforeCompile = sh => {
    sh.uniforms.uRing = { value: new THREE.Color('#d8102b') }
    OBJ_VARYINGS_VS(sh)
    sh.fragmentShader =
      'uniform vec3 uRing;\n' + OBJ_VARYINGS_FS +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rr = length(vObjPos.xy);
        float side = smoothstep(0.5, 0.7, abs(normalize(vObjN).z));
        float ring = smoothstep(0.247, 0.251, rr) * (1.0 - smoothstep(0.266, 0.27, rr)) * side;
        diffuseColor.rgb = mix(diffuseColor.rgb, uRing, ring);`,
      )
  }

  const rim = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1f24'), roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide })

  /** Helmet: gloss shell, accent crown, dark visor band facing forward. */
  const helmet = new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 })
  helmet.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uBase: U.base, uAccent: U.accent, uAccent2: U.accent2 })
    OBJ_VARYINGS_VS(sh)
    sh.fragmentShader =
      'uniform vec3 uBase;\nuniform vec3 uAccent;\nuniform vec3 uAccent2;\n' + OBJ_VARYINGS_FS +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vObjPos - vec3(0.2, 0.8, 0.0);
        vec3 col = mix(uBase, uAccent, smoothstep(0.01, 0.02, p.y));
        col = mix(col, uAccent2, smoothstep(0.045, 0.05, p.y));
        float visor = step(0.03, p.x) * (1.0 - smoothstep(0.018, 0.022, abs(p.y + 0.004)));
        col = mix(col, vec3(0.01), visor);
        diffuseColor.rgb = col;`,
      )
  }

  // --- procedural power unit / radiator / lights (prototype 295–311) ---
  const accentMat = new THREE.MeshPhysicalMaterial({ roughness: 0.28, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 })
  const accent2Mat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 })
  const chrome = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8ecf0'), roughness: 0.04, metalness: 1 })
  const ti = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#b07b50'), roughness: 0.3, metalness: 1, clearcoat: 0.3 })
  const alu = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa1a9'), roughness: 0.35, metalness: 0.9 })
  const hv = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ff7a1a'), roughness: 0.45, metalness: 0.1, emissive: new THREE.Color('#ff5a00'), emissiveIntensity: 0 })
  const mguk = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1f26'), roughness: 0.35, metalness: 0.7, emissive: new THREE.Color(), emissiveIntensity: 0.3 })
  const radiator = new THREE.MeshStandardMaterial({ map: finTex(), roughness: 0.4, metalness: 0.8 })
  const rain = new THREE.MeshStandardMaterial({ color: new THREE.Color('#300'), emissive: new THREE.Color('#ff1e1e'), emissiveIntensity: 2 })
  const brake = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2a2a'), emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 0, roughness: 0.6, metalness: 0.6 })
  const exGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })

  const mats = { paint, carbon, tyre, rim, helmet, accentMat, accent2Mat, chrome, ti, alu, hv, mguk, radiator, rain, brake, exGlow }

  function applyLivery(l: Livery) {
    U.base.value.set(l.base)
    U.accent.value.set(l.accent)
    U.accent2.value.set(l.accent2)
    paint.roughness = l.roughness
    paint.clearcoat = l.clearcoat
    accentMat.color.set(l.accent)
    accent2Mat.color.set(l.accent2)
    mguk.emissive.set(l.accent)
  }

  function dispose() {
    U.carbon.value.dispose()
    radiator.map?.dispose()
    Object.values(mats).forEach(m => m.dispose())
  }

  return { ...mats, applyLivery, dispose }
}

export type CarMaterials = ReturnType<typeof createCarMaterials>
