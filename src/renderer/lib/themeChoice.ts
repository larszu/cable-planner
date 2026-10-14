import { useUiStore } from '../store/uiStore'

export type ThemeChoice = 'auto' | 'light' | 'dark'

/** The current choice: `auto` while the app follows the OS theme. */
export const useThemeChoice = (): ThemeChoice => {
  const follow = useUiStore((s) => s.followSystemTheme)
  const theme = useUiStore((s) => s.canvasTheme)
  return follow ? 'auto' : theme
}

export const setThemeChoice = (choice: ThemeChoice) => {
  const ui = useUiStore.getState()
  if (choice === 'auto') {
    ui.setFollowSystemTheme(true)
    return
  }
  ui.setFollowSystemTheme(false)
  ui.setCanvasTheme(choice)
}
