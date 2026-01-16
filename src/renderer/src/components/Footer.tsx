import { useEffect, useState } from 'react'
import { getAppVersion, getAppName} from '../utils'


export function Footer() {
  const [version, setVersion] = useState<string>('')
  const [appName, setAppName] = useState<string>('')
  useEffect(() => {
    getAppVersion().then(setVersion)
    getAppName().then(setAppName)
  }, [])

  return (
    <footer className="bg-bg-card border-t border-border px-4 py-2 text-xs text-text-muted flex justify-between">
      <span>{appName}</span>
      <span style={{ fontSize:'80%' }} >v{version} | LANG : CS | BUILD : 261601</span>
    </footer>
  )
}
