import { useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Local state that re-initialises from `source` whenever `source` changes —
 * without a sync effect. Uses React's recommended "adjust state during render"
 * pattern (remembering the previous source) instead of
 * `useEffect(() => setDraft(source), [source])`, so there are no cascading
 * effect renders (react-hooks/set-state-in-effect).
 *
 * Use for an editable draft seeded from a prop/store value: local edits persist
 * until `source` changes, then the draft resets to the new source.
 *
 * See https://react.dev/reference/react/useState#storing-information-from-previous-renders
 */
export function useSyncedState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(source)
  const [prevSource, setPrevSource] = useState(source)
  if (prevSource !== source) {
    setPrevSource(source)
    setValue(source)
  }
  return [value, setValue]
}
