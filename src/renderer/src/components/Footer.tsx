import { useEffect, useState } from 'react'
import { getAppVersion, getAppName} from '../utils'
import { useLocaleStore } from '../i18n'


export function Footer() {
  const localeStore = useLocaleStore()
  const [version, setVersion] = useState<string>('')
  const [appName, setAppName] = useState<string>('')
  useEffect(() => {
    getAppVersion().then(setVersion)
    getAppName().then(setAppName)
  }, [])

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border px-4 py-2 text-xs text-text-muted flex justify-between z-50">
      <span>{appName}</span>
      <span style={{ fontSize:'80%' }} >v{version} | LANG : {localeStore.locale.toUpperCase()} | BUILD : 261601</span>
    </footer>
  )
}
