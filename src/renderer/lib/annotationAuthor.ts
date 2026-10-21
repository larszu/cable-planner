// Anmerkungen anlegen — eine Stelle fuer Panel und Kontextmenues.
//
// Der Leer-Hinweis im Anmerkungs-Panel verspricht "Rechtsklick auf Geraet /
// Kabel". Dafuer brauchen Geraete- und Kabelmenue denselben Ablauf wie das
// Panel: Namen einmal erfragen (kein "Anonym"), dann den Text. Beides lebt
// deshalb hier statt in der Komponente.

import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import { promptDialog } from './promptDialog'
import { tr } from './i18n'
import type { ProjectAnnotation } from '../types/project'

/** Effektiver Autor fuer neue Anmerkungen; fragt einmal per In-App-Dialog.
 *  null, wenn der Nutzer abbricht. */
export const ensureAnnotationAuthor = async (): Promise<string | null> => {
  const uiState = useUiStore.getState()
  const fromViewer = useProjectStore.getState().project.viewerSession?.author?.trim()
  if (fromViewer) return fromViewer
  const fromStore = uiState.annotationAuthor?.trim()
  if (fromStore) return fromStore
  const name = (
    await promptDialog(
      tr(
        'annotations.authorPrompt',
        'Please enter your name. It will be attached to every annotation you create from now on.',
      ),
      '',
    )
  )?.trim()
  if (!name) return null
  uiState.setAnnotationAuthor(name)
  return name
}

/** Kontextmenue: Anmerkung an Geraet oder Kabel. Gibt die neue Anmerkung
 *  zurueck oder null bei Abbruch. */
export const addAnnotationAt = async (
  anchor: ProjectAnnotation['anchor'],
): Promise<ProjectAnnotation | null> => {
  const author = await ensureAnnotationAuthor()
  if (!author) return null
  const text = (await promptDialog(tr('annotations.textPrompt', 'Annotation'), ''))?.trim()
  if (!text) return null
  const annotation: ProjectAnnotation = {
    id: uuidv4(),
    author,
    createdAt: new Date().toISOString(),
    text,
    status: 'open',
    anchor,
  }
  useProjectStore.getState().addAnnotation(annotation)
  return annotation
}
