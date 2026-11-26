export interface Device {
  readonly input: AudioNode
  readonly output: AudioNode
  noteOn(id: number, frequency: number, gain?: number): void
  noteOff(id: number): void
  setParam(name: string, value: number): void
  dispose(): void
}
type Make = (context: BaseAudioContext, options?: { params?: Record<string, number>; processorUrl?: string; wasm?: URL | string | BufferSource }) => Promise<Device>
interface Strip {
  setLevel(value: number): void
  readonly sends: { add(to: ReturnTrack, options: { level: number }): void }
}
interface Options {
  name: string
  device: Device
  destination: AudioNode
  context: BaseAudioContext
}
export class InstrumentTrack {
  constructor(options: Options)
  readonly device: Device
  readonly strip: Strip
  noteOn(id: number, frequency: number, gain?: number): void
  noteOff(id: number): void
}
export class ReturnTrack {
  constructor(options: Options)
  readonly strip: Strip
}
export const createThesis: Make
export const createAtmosphere: Make
export const createDroplets: Make
export const createHandpan: Make
export const createFeltPiano: Make
export const createPlateReverb: Make
