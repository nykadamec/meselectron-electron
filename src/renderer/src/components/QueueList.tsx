import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2 } from 'lucide-react'
import type { QueueItem } from '../types'
import { useLocaleStore } from '../i18n'

interface QueueListProps {
  queue: QueueItem[]
  isQueuePaused?: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onRemove?: (itemId: string) => void
  onReorder?: (newQueue: QueueItem[]) => void
  onKill?: (itemId: string) => void
}

// Helper functions for formatting
const formatSize = (bytes?: number) => {
  if (!bytes) return 'N/A'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const formatSpeed = (bytesPerSecond?: number) => {
  if (!bytesPerSecond) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const formatETA = (seconds?: number) => {
  if (!seconds || seconds < 0) return 'N/A'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m ${secs}s`
}

/**
 * Strip size prefix from title
 * Format: "[  2.62 GB  ] - Some Title" -> "Some Title"
 */
const stripSizePrefix = (title: string): string => {
  // Pattern: [  XX.XX GB  ] - or [  XX.XX MB  ] - or [  X.XX GB  ] -
  const sizePrefixPattern = /^\[\s*[\d.]+\s*(GB|MB|KB)\s*\]\s*-\s*/
  return title.replace(sizePrefixPattern, '').trim()
}

// Sortable Queue Item Component
function SortableQueueItem({
  item,
  onRemove,
  onKill,
  isActive
}: {
  item: QueueItem
  onRemove?: (itemId: string) => void
  onKill?: (itemId: string) => void
  isActive: boolean
}) {
  const t = useLocaleStore(state => state.t)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: item.id,
    disabled: isActive // Disable dragging for active item
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'var(--color-accent-base)'
      case 'completed': return 'var(--color-success)'
      case 'failed': return 'var(--color-error)'
      case 'paused': return 'var(--color-warning)'
      default: return 'var(--color-text-muted)'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('queue.active')
      case 'completed': return t('queue.completed')
      case 'failed': return t('queue.failed')
      case 'paused': return t('queue.paused')
      case 'pending': return t('queue.pending')
      default: return status
    }
  }

  const statusColor = getStatusColor(item.status)

  // Calculate progress percentage
  const progressPercent = item.phase === 'upload' ? (item.uploadProgress || 0) : (item.progress || 0)

  return (
    <div
      data-elname="queue-item"
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: 10,
        border: '1px solid var(--color-border-base)',
        borderLeft: `4px solid ${statusColor}`,
        padding: 14,
        marginBottom: 8,
        transition: 'all 0.15s ease'
      }}
      className={isDragging ? 'shadow-lg ring-2 ring-accent' : ''}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {/* Status indicator or Drag handle/Kill button */}
            {item.status === 'active' && onKill ? (
              <button
                data-elname="kill-button"
                onClick={() => onKill(item.id)}
                style={{
                  padding: 4,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--color-error)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(239 68 68 / 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title={t('queue.cancel')}
              >
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button
                data-elname="drag-handle"
                style={{
                  padding: 4,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'grab',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                {...attributes}
                {...listeners}
              >
                <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </button>
            )}

            {/* Animated status dot for active items */}
            {item.status === 'active' && (
              <div data-elname="active-dot" style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: statusColor,
                animation: 'pulse 2s infinite',
                flexShrink: 0
              }} />
            )}

            {/* Size indicator */}
            {item.size && (
              <span data-elname="size-badge" style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontFamily: 'monospace',
                backgroundColor: 'var(--color-surface-base)',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                [{formatSize(item.size)}]
              </span>
            )}

            {/* Title */}
            <span data-elname="item-title" style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {stripSizePrefix(item.video.title)}
            </span>
          </div>

          {/* Active item details */}
          {item.status === 'active' && (
            <div style={{ paddingLeft: 26 }}>
              {/* Phase and progress label */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8
              }}>
                <span data-elname="phase-label" style={{
                  fontSize: 12,
                  color: 'var(--color-accent-base)',
                  fontWeight: 500
                }}>
                  {item.phase === 'upload' ? t('queue.uploadPhase') :
                   item.subPhase === 'assembling' ? t('queue.assembling') :
                   t('queue.downloadPhase')}
                </span>
                <span data-elname="progress-percent" style={{
                  fontSize: 12,
                  color: 'var(--color-accent-base)',
                  fontWeight: 600
                }}>
                  {progressPercent.toFixed(1)}%
                </span>
              </div>

              {/* Progress bar - VYŠŠÍ A VIDITELNĚJŠÍ */}
              <div data-elname="progress-bar" style={{
                height: 10,
                backgroundColor: 'var(--color-surface-base)',
                borderRadius: 5,
                overflow: 'hidden',
                border: '1px solid var(--color-border-base)',
                marginBottom: 10
              }}>
                <div data-elname="progress-fill" style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: statusColor,
                  borderRadius: 5,
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Status message */}
              {item.statusMessage && (
                <div data-elname="status-message" style={{
                  fontSize: 11,
                  color: 'var(--color-accent-base)',
                  fontFamily: 'monospace',
                  marginBottom: 8
                }}>
                  {item.statusMessage}
                </div>
              )}

              {/* Stats row */}
              <div data-elname="item-stats" style={{
                display: 'flex',
                gap: 16,
                fontSize: 11,
                color: 'var(--color-text-muted)'
              }}>
                <span data-elname="size-text">{formatSize(item.size)}</span>
                <span data-elname="speed-text">{formatSpeed(item.speed)}</span>
                <span data-elname="eta-text">ETA: {formatETA(item.eta)}</span>
              </div>
            </div>
          )}

          {/* Pending/Other item details */}
          {item.status !== 'active' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingLeft: 26,
              fontSize: 11,
              color: 'var(--color-text-muted)'
            }}>
              {item.size && <span data-elname="size-text">{formatSize(item.size)}</span>}
              <span data-elname="status-text" style={{
                color: statusColor,
                fontWeight: 500
              }}>{getStatusLabel(item.status)}</span>
              {item.error && (
                <span data-elname="error-text" style={{ color: 'var(--color-error)' }}>
                  ({item.error})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side - Priority number and Remove button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span data-elname="priority-number" style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontWeight: 500
          }}>
            #{item.priority}
          </span>

          {/* Delete button (for all non-active items) */}
          {onRemove && item.status !== 'active' && (
            <button
              data-elname="delete-button"
              onClick={() => onRemove(item.id)}
              style={{
                padding: 4,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-error)'
                e.currentTarget.style.backgroundColor = 'rgb(239 68 68 / 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title={item.status === 'completed' ? t('queue.delete') : t('queue.remove')}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function QueueList({
  queue,
  isQueuePaused,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onReorder,
  onKill
}: QueueListProps) {
  const [items, setItems] = useState(queue)
  const [activeId, setActiveId] = useState<string | null>(null)
  const t = useLocaleStore(state => state.t)

  // Sync items with queue prop (including progress updates)
  useEffect(() => {
    // If we're dragging, don't update from props
    if (activeId) return

    // Check if we need to update
    const needsUpdate = items.length !== queue.length ||
      items.some((item, idx) => {
        const queueItem = queue[idx]
        if (!queueItem) return true
        return item.id !== queueItem.id ||
          item.progress !== queueItem.progress ||
          item.uploadProgress !== queueItem.uploadProgress ||
          item.speed !== queueItem.speed ||
          item.eta !== queueItem.eta ||
          item.size !== queueItem.size ||
          item.status !== queueItem.status
      })

    if (needsUpdate) {
      setItems(queue)
    }
  }, [queue, items.length, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const pendingCount = items.filter(item => item.status === 'pending').length
  const failedCount = items.filter(item => item.status === 'failed').length

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const newItems = arrayMove(items, oldIndex, newIndex)

      // Update priority numbers
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        priority: index + 1
      }))

      setItems(updatedItems)

      // Notify parent
      if (onReorder) {
        onReorder(updatedItems)
      }
    }
  }

  return (
    <div data-elname="queue-container" className="space-y-2">
      {/* Queue stats */}
      <div data-elname="queue-stats" className="flex justify-end items-center text-sm text-text-muted">
        <span>{t('queue.stats', { pending: String(pendingCount), failed: String(failedCount) })}</span>
      </div>

      {/* Queue items with drag & drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div data-elname="queue-scroll" className="max-h-60 overflow-y-auto space-y-2">
            {items.map((item) => (
              <SortableQueueItem
                key={item.id}
                item={item}
                onRemove={onRemove}
                onKill={onKill}
                isActive={item.status === 'active'}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Queue controls */}
      {(onPause || onResume || onCancel || onRetry) && (
        <div data-elname="queue-controls" className="flex gap-2 mt-2">
          {onPause && !isQueuePaused && (
            <button data-elname="queue-pause-btn" onClick={onPause} className="btn-secondary text-xs px-3 py-1">
              {t('queue.pause')}
            </button>
          )}
          {onResume && isQueuePaused && (
            <button data-elname="queue-resume-btn" onClick={onResume} className="btn-secondary text-xs px-3 py-1">
              {t('queue.resume')}
            </button>
          )}
          {onRetry && failedCount > 0 && (
            <button data-elname="queue-retry-btn" onClick={onRetry} className="btn-secondary text-xs px-3 py-1">
              {t('queue.retry', { count: String(failedCount) })}
            </button>
          )}
          {onCancel && items.length > 0 && (
            <button data-elname="queue-cancel-btn" onClick={onCancel} className="btn-error text-xs px-3 py-1">
              {t('queue.cancelQueue')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
