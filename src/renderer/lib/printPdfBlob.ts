// v7.9.4 — Open a freshly built PDF blob in a hidden iframe and trigger the
// browser/Electron print dialog. Closest we get to real native printing
// without bundling a platform-specific print driver: the OS dialog appears
// with the real printer list, paper sizes, copies + orientation.

export const printPdfBlob = (pdfBlob: Blob): void => {
  const url = URL.createObjectURL(pdfBlob)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      /* fall back silently */
    }
    // Revoke after a delay so the print job isn't cut off mid-stream.
    window.setTimeout(() => {
      document.body.removeChild(iframe)
      URL.revokeObjectURL(url)
    }, 60_000)
  }
}
