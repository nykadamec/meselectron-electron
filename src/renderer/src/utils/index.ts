


export async function getAppVersion(): Promise<string> {
  const version = await window.electronAPI.versionGet()
  return version || 'unknown'
}

export async function getAppBuild(): Promise<string> {
  const build = await window.electronAPI.buildGet()
  return build || 'unknown'
}

export async function getAppName(): Promise<string> {
  const name = await window.electronAPI.nameGet()
  return name || 'unknown'
}