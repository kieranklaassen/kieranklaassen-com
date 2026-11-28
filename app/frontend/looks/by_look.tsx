import { usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import { roomLayoutOf, type Art, type Look, type RoomLayout } from './rooms'

/** The painted page under the look that was chosen, or its children where it is the site as it was. */
export function ByLook({ painted, children }: { painted: (rooms: RoomLayout) => ReactNode; children?: ReactNode }) {
  const { props, component } = usePage<{ look?: Look; art?: Art }>()
  const rooms = roomLayoutOf(props.look, component, props.art)
  return <>{rooms ? painted(rooms) : children}</>
}
