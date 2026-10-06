/** Derive a human-readable project name from a file path (drops extension). */
export const nameFromPath = (filePath: string): string => {
  const base = filePath.split(/[\\/]/).pop() ?? filePath
  // .cableplan is the project extension; .json/.cpviewer stay backward compatible.
  return base.replace(/\.(cableplan|json|cpviewer)$/i, '')
}

/**
 * Project name after "Save as…": the chosen file name always becomes the new
 * title (#986). Returns null when the name is already identical or empty.
 */
export const nameAfterSaveAs = (currentName: string, savedPath: string): string | null => {
  const next = nameFromPath(savedPath).trim()
  return next && next !== currentName ? next : null
}
