// The page has one context, and whatever sounds is in it.

let context: AudioContext | undefined

export const theContext = () => (context ??= new AudioContext())
