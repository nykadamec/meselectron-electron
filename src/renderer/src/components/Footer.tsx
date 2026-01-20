import { useEffect, useState } from 'react'
import { getAppVersion, getAppName, getAppBuild } from '../utils'
import { useLocaleStore } from '../i18n'
import { get } from 'node:http'

export function Footer() {
  const localeStore = useLocaleStore()
  const [version, setVersion] = useState<string>('')
  const [appName, setAppName] = useState<string>('')
  const [appBuild, setAppBuild] = useState<string>('')

  useEffect(() => {
    getAppVersion().then(setVersion)
    getAppName().then(setAppName)
    getAppBuild().then(setAppBuild)
  }, [])

  return (
    <footer data-elname="app-footer" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'var(--color-surface-base)',
      borderTop: '1px solid var(--color-border-base)',
      padding: '8px 16px',
      fontSize: 11,
      color: 'var(--color-text-muted)',
      display: 'flex',
      justifyContent: 'space-between',
      zIndex: 50
    }}>
      <span data-elname="footer-app-name">{appName}</span>
      <span data-elname="footer-version" style={{ fontSize: '90%' }}>v{version} | LANG: {localeStore.locale.toUpperCase()} | BUILD: {appBuild}</span>
    </footer>
  )
}
