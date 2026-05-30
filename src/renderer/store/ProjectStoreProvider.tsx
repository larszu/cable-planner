import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { ProjectStoreContext } from './projectStoreContext'
import type { ProjectState } from './projectStore'

/** Wraps a sub-tree with an alternative project-store instance (used by
 *  RackInternalCanvas to feed the real CanvasArea a scratch store). The
 *  context-aware hooks live in `./projectStoreContext`. */
export const ProjectStoreProvider = ({
  store,
  children,
}: {
  store: StoreApi<ProjectState>
  children: ReactNode
}) => (
  <ProjectStoreContext.Provider value={store}>{children}</ProjectStoreContext.Provider>
)
