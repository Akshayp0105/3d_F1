// Phase state machine (see CLAUDE.md → State machine). Pure: transition(phase, event) → next phase.
export type Phase = 'idle' | 'exploded' | 'cinematic' | 'returning'
export type PhaseEvent = 'tapCar' | 'launch' | 'reachDecel' | 'skipToReturn' | 'finish'

const TABLE: Record<Phase, Partial<Record<PhaseEvent, Phase>>> = {
  idle: { tapCar: 'exploded', launch: 'cinematic' },
  exploded: { tapCar: 'idle', launch: 'cinematic' },
  cinematic: { reachDecel: 'returning', skipToReturn: 'returning' },
  returning: { finish: 'idle' },
}

export function transition(phase: Phase, event: PhaseEvent): Phase {
  return TABLE[phase][event] ?? phase
}

export const isCine = (p: Phase) => p === 'cinematic' || p === 'returning'
