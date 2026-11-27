// The piano the score is played on: the Ambient Town engine's felt piano, in a plate.

import { createFeltPiano, createPlateReverb, InstrumentTrack, ReturnTrack } from '../../../vendor/engine/engine.js'

export interface Keys {
  strike: (frequency: number, gain: number, after: number, rings: number) => void
  hush: () => void
}

export async function makeKeys(context: BaseAudioContext, out: AudioNode): Promise<Keys> {
  const [piano, plate] = await Promise.all([
    createFeltPiano(context, { params: { reverbMix: 0.15 } }),
    createPlateReverb(context, { params: { mix: 1, decay: 0.8, damping: 0.4, predelayMs: 18 } }),
  ])
  const room = new ReturnTrack({ name: 'room', device: plate, destination: out, context })
  const track = new InstrumentTrack({ name: 'piano', device: piano, destination: out, context })
  track.strip.sends.add(room, { level: 0.45 })
  let ids = 1
  const held = new Set<number>()
  return {
    strike(frequency, gain, after, rings) {
      const id = ids++
      window.setTimeout(() => {
        held.add(id)
        track.noteOn(id, frequency, gain)
      }, after * 1000)
      window.setTimeout(() => {
        held.delete(id)
        track.noteOff(id)
      }, (after + rings) * 1000)
    },
    hush() {
      held.forEach((id) => track.noteOff(id))
      held.clear()
    },
  }
}
