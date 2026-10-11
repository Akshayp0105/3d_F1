import { useStore } from './store'
import { engineAudio } from '@/audio/engine'

/** Start the launch sequence. Call from a user gesture so the AudioContext can unlock. */
export function launch() {
  const { toggles, dispatch } = useStore.getState()
  if (toggles.sound) engineAudio.unlock()
  dispatch('launch')
}
