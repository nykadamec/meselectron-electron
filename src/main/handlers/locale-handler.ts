// Locale Handler - locale:read
import { ipcMain } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import { getProjectRoot } from '../utils/paths'

ipcMain.handle('locale:read', async (_, locale: 'en' | 'cz') => {
  const possiblePaths = [
    path.join(process.cwd(), 'locales', `${locale}.yaml`),
    path.join(getProjectRoot(), 'locales', `${locale}.yaml`),
    path.join(__dirname, '..', '..', 'locales', `${locale}.yaml`),
    path.join(__dirname, '..', 'locales', `${locale}.yaml`)
  ]

  for (const filePath of possiblePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch {
      // Continue to next path
    }
  }

  return ''
})
