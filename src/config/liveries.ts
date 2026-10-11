// Livery tokens. Hex values are eyeballed from the reference photos.
// TODO(brand): replace with official values from Red Bull's brand guidelines (see public/brand/README.md).
export interface Livery {
  name: string
  /** body base colour */
  base: string
  /** primary accent (red) */
  accent: string
  /** secondary accent (yellow nose / sun) */
  accent2: string
  /** paint roughness: matte race livery vs gloss specials */
  roughness: number
  clearcoat: number
}

export const LIVERIES: Livery[] = [
  { name: 'RB16B matte race livery', base: '#0d1430', accent: '#d8102b', accent2: '#ffc906', roughness: 0.5, clearcoat: 0.25 },
  { name: 'Gloss navy', base: '#121a3c', accent: '#e3172d', accent2: '#ffc906', roughness: 0.22, clearcoat: 1 },
  { name: 'Arigato white', base: '#eceae6', accent: '#d8102b', accent2: '#1b2347', roughness: 0.3, clearcoat: 1 },
  { name: 'Carbon stealth', base: '#14161a', accent: '#d8102b', accent2: '#ffc906', roughness: 0.38, clearcoat: 0.6 },
]
