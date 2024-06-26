import { readFileSync } from 'fs'
import { Page } from '@playwright/test'

interface File {
  name: string
  path: string
}

interface FileBuffer {
  name: string
  bufferString: string
}

export const dragDropFiles = async (page: Page, resources: File[], targetSelector: string) => {
  const files = resources.map((file) => ({
    name: file.name,
    bufferString: JSON.stringify(Array.from(readFileSync(file.path)))
  }))

  await page.evaluate<Promise<void>, [FileBuffer[], string]>(
    ([files, targetSelector]) => {
      const dropArea = document.querySelector(targetSelector)
      const dt = new DataTransfer()

      for (const file of files) {
        const buffer = Buffer.from(JSON.parse(file.bufferString))
        const blob = new Blob([buffer])
        dt.items.add(new File([blob], file.name))
      }

      dropArea.dispatchEvent(new DragEvent('drop', { dataTransfer: dt }))

      return Promise.resolve()
    },
    [files, targetSelector]
  )
}
