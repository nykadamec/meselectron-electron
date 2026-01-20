import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
import type { MyVideo } from '../types'
import { useLocaleStore } from '../i18n'

interface DeleteConfirmationModalProps {
  video: MyVideo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteConfirmationModal({
  video,
  open,
  onOpenChange,
  onConfirm,
  isDeleting
}: DeleteConfirmationModalProps) {
  const { t } = useLocaleStore()

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      onOpenChange(false)
    }
  }

  if (!video) return null

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-elname="dialog-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in z-50" />
        <Dialog.Content data-elname="dialog-content" className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-base border border-border-base rounded-xl shadow-elevated animate-slide-in z-50 focus:outline-none">
          <div className="p-6">
            {/* Header */}
            <div data-elname="modal-header" className="flex items-center gap-3 mb-4">
              <div data-elname="modal-icon" className="w-10 h-10 rounded-full bg-error/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-error" />
              </div>
              <Dialog.Title data-elname="modal-title" className="text-lg font-semibold text-text-primary">
                {t('delete.title')}
              </Dialog.Title>
            </div>

            {/* Content */}
            <Dialog.Description data-elname="modal-description" className="text-sm text-text-secondary mb-6">
              {t('delete.message', { title: video.title })}
            </Dialog.Description>

            {/* Video Preview */}
            <div data-elname="video-preview" className="flex items-center gap-3 p-3 bg-bg-hover rounded-lg mb-6">
              <div data-elname="preview-thumb" className="w-20 h-12 bg-surface-elevated rounded overflow-hidden flex-shrink-0">
                {video.thumbnail ? (
                  <img
                    data-elname="thumbnail-image"
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div data-elname="thumb-placeholder" className="w-full h-full flex items-center justify-center">
                    <svg data-elname="thumbnail-icon" className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p data-elname="preview-title" className="text-sm font-medium text-text-primary truncate">{video.title}</p>
                {video.size && (
                  <p data-elname="preview-size" className="text-xs text-text-muted">{video.size}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div data-elname="modal-actions" className="flex justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  data-elname="cancel-button"
                  className="btn-secondary"
                  disabled={isDeleting}
                >
                  {t('delete.cancel')}
                </button>
              </Dialog.Close>
              <button
                data-elname="confirm-button"
                onClick={handleConfirm}
                disabled={isDeleting}
                className="btn-primary bg-error hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div data-elname="confirm-spinner" className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('actions.loading')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('delete.confirm')}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              data-elname="close-button"
              className="absolute right-4 top-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
