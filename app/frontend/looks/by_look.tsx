import { usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import { roomsOf, type Look, type Rooms } from './looks'

/** The painted page under the look that was chosen, or its children where it is the site as it was. */
export function ByLook({ painted, children }: { painted: (rooms: Rooms) => ReactNode; children?: ReactNode }) {
  const { props, component } = usePage<{ look?: Look }>()
  const rooms = roomsOf(props.look, component)
  return <>{rooms ? painted(rooms) : children}</>
}
