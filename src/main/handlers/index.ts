// Handler Index - exports all IPC handlers for easy importing
// Import handlers to register them with ipcMain

// Settings handlers
import './settings-handler'

// Account handlers
import './accounts-handler'

// File handlers
import './file-handler'

// Version handlers
import './version-handler'

// Download handlers
import './download-handler'

// Upload handlers
import './upload-handler'

// Discover handlers
import './discover-handler'

// Session handlers
import './session-handler'

// Updater handlers (modular)
import './updater/index'

// Locale handlers
import './locale-handler'

console.log('[IPC] All handlers registered')
