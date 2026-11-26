// The page has one context, and whatever sounds is in it.

let context: AudioContext | undefined

export function theContext() {
  if (context) return context
  // On a phone it plays beside whatever the visitor already listens to, and does not stop it.
  const { audioSession } = navigator as Navigator & { audioSession?: { type: string } }
  if (audioSession) audioSession.type = 'ambient'
  return (context = new AudioContext())
}
