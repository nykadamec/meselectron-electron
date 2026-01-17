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
import type { QueueItem } from '../types'

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
      case 'active': return 'bg-accent animate-pulse'
      case 'completed': return 'bg-success'
      case 'failed': return 'bg-error'
      case 'paused': return 'bg-warning'
      default: return 'bg-text-muted'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Zpracovává'
      case 'completed': return 'Hotovo'
      case 'failed': return 'Chyba'
      case 'paused': return 'Pozastaveno'
      case 'pending': return 'Čeká'
      default: return status
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-bg-main rounded-lg border-l-2 ${
        item.status === 'active' ? 'border-accent' :
        item.status === 'failed' ? 'border-error' :
        item.status === 'completed' ? 'border-success' :
        'border-border'
      } ${isDragging ? 'shadow-lg ring-2 ring-accent' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Drag handle or Kill button */}
            {item.status === 'active' && onKill ? (
              <button
                onClick={() => onKill(item.id)}
                className="cursor-grab active:cursor-grabbing p-1 text-error hover:text-error/80 transition-colors"
                title="Zrušit stahování"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button
                className="cursor-grab active:cursor-grabbing p-1 text-text-muted hover:text-text-primary transition-colors"
                {...attributes}
                {...listeners}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </button>
            )}
            <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`} />
            <p className="text-sm font-medium truncate">{item.video.title}</p>
          </div>

          {/* Active item details */}
          {item.status === 'active' && (
            <div className="space-y-1 mt-2 ml-6">
              {/* Phase label */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-accent">
                  {item.phase === 'upload' ? '↑ Nahrávání ' :
                   item.subPhase === 'assembling' ? '↓ Compiling chunks ' :
                   '↓ Stahování '}
                  [{((item.phase === 'upload' ? item.uploadProgress : item.progress) || 0).toFixed(2)}%]
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${item.phase === 'upload' ? (item.uploadProgress || 0) : (item.progress || 0)}%` }}
                />
              </div>

              {/* Status message */}
              {item.statusMessage && (
                <div className="text-xs text-accent font-mono mt-1">
                  {item.statusMessage}
                </div>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                <span>{formatSize(item.size)}</span>
                <span>{formatSpeed(item.speed)}</span>
                <span>ETA: {formatETA(item.eta)}</span>
                <span className="capitalize">{getStatusLabel(item.status)}</span>
              </div>
            </div>
          )}

          {/* Pending/Other item details */}
          {item.status !== 'active' && (
            <div className="flex flex-wrap gap-2 text-xs text-text-muted ml-6">
              {item.size && <span>{formatSize(item.size)}</span>}
              <span className="capitalize">{getStatusLabel(item.status)}</span>
              {item.error && <span className="text-error">({item.error})</span>}
            </div>
          )}
        </div>

        {/* Remove button (only for non-active pending/failed items) */}
        {onRemove && item.status !== 'active' && (
          <button
            onClick={() => onRemove(item.id)}
            className="p-1 text-text-muted hover:text-error transition-colors"
            title="Odebrat z fronty"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Priority number */}
        <span className="text-xs text-text-muted">#{item.priority}</span>
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
    <div className="space-y-2">
      {/* Queue stats */}
      <div className="flex justify-end items-center text-sm text-text-muted">
        <span>{pendingCount} čeká | {failedCount} chybných</span>
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
          <div className="max-h-60 overflow-y-auto space-y-2">
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
        <div className="flex gap-2 mt-2">
          {onPause && !isQueuePaused && (
            <button onClick={onPause} className="btn-secondary text-xs px-3 py-1">
              Pozastavit
            </button>
          )}
          {onResume && isQueuePaused && (
            <button onClick={onResume} className="btn-secondary text-xs px-3 py-1">
              Pokračovat
            </button>
          )}
          {onRetry && failedCount > 0 && (
            <button onClick={onRetry} className="btn-secondary text-xs px-3 py-1">
              Zkusit znovu ({failedCount})
            </button>
          )}
          {onCancel && items.length > 0 && (
            <button onClick={onCancel} className="btn-error text-xs px-3 py-1">
              Zrušit frontu
            </button>
          )}
        </div>
      )}
    </div>
  )
}
