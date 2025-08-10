import { useState, useCallback, useRef, useEffect } from 'react';

interface DragItem {
  id: string;
  type: string;
  data: any;
  index?: number;
}

interface DropZone {
  id: string;
  accepts: string[];
  onDrop: (item: DragItem, dropZoneId: string) => void;
  onHover?: (item: DragItem | null, dropZoneId: string) => void;
  canDrop?: (item: DragItem) => boolean;
}

interface DragAndDropConfig {
  onDragStart?: (item: DragItem) => void;
  onDragEnd?: (item: DragItem | null) => void;
  onDrop?: (item: DragItem, dropZoneId: string) => void;
  enableTouch?: boolean;
  dragImage?: HTMLElement;
  hapticFeedback?: boolean;
}

/**
 * World-class Drag and Drop Hook
 * Supports mouse, touch, keyboard navigation
 */
export function useDragAndDrop(config: DragAndDropConfig = {}) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [dropZones] = useState<Map<string, DropZone>>(new Map());
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragImageRef = useRef<HTMLElement | null>(null);
  const touchTimeoutRef = useRef<NodeJS.Timeout>();

  // Register drop zone
  const registerDropZone = useCallback((zone: DropZone) => {
    dropZones.set(zone.id, zone);
    
    return () => {
      dropZones.delete(zone.id);
    };
  }, [dropZones]);

  // Start drag
  const startDrag = useCallback((item: DragItem, event?: React.DragEvent | React.TouchEvent) => {
    setIsDragging(true);
    setDraggedItem(item);
    
    // Calculate offset for smooth dragging
    if (event && 'clientX' in event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    // Haptic feedback on mobile
    if (config.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }

    config.onDragStart?.(item);
  }, [config]);

  // End drag
  const endDrag = useCallback((success: boolean = false) => {
    if (!success && config.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]); // Error pattern
    }

    setIsDragging(false);
    config.onDragEnd?.(draggedItem);
    setDraggedItem(null);
    setDragOverZone(null);
    setDragOffset({ x: 0, y: 0 });
  }, [draggedItem, config]);

  // Handle drop
  const handleDrop = useCallback((dropZoneId: string) => {
    if (!draggedItem) return;

    const zone = dropZones.get(dropZoneId);
    if (!zone) return;

    // Check if drop is allowed
    if (!zone.accepts.includes(draggedItem.type)) {
      endDrag(false);
      return;
    }

    if (zone.canDrop && !zone.canDrop(draggedItem)) {
      endDrag(false);
      return;
    }

    // Success feedback
    if (config.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(100);
    }

    zone.onDrop(draggedItem, dropZoneId);
    config.onDrop?.(draggedItem, dropZoneId);
    endDrag(true);
  }, [draggedItem, dropZones, config, endDrag]);

  // Make element draggable
  const makeDraggable = useCallback((item: DragItem) => {
    const handlers = {
      // Mouse events
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        
        // Custom drag image
        if (config.dragImage) {
          e.dataTransfer.setDragImage(config.dragImage, dragOffset.x, dragOffset.y);
        }
        
        startDrag(item, e);
      },
      
      onDragEnd: (e: React.DragEvent) => {
        e.preventDefault();
        endDrag();
      },

      // Touch events (if enabled)
      ...(config.enableTouch ? {
        onTouchStart: (e: React.TouchEvent) => {
          // Long press to start drag
          touchTimeoutRef.current = setTimeout(() => {
            startDrag(item, e);
            
            // Create custom drag image for touch
            if (e.target instanceof HTMLElement) {
              const clone = e.target.cloneNode(true) as HTMLElement;
              clone.style.position = 'fixed';
              clone.style.pointerEvents = 'none';
              clone.style.opacity = '0.8';
              clone.style.zIndex = '9999';
              clone.style.transform = 'scale(1.05)';
              document.body.appendChild(clone);
              dragImageRef.current = clone;
              
              // Position at touch point
              const touch = e.touches[0];
              clone.style.left = `${touch.clientX - dragOffset.x}px`;
              clone.style.top = `${touch.clientY - dragOffset.y}px`;
            }
          }, 500);
        },
        
        onTouchMove: (e: React.TouchEvent) => {
          if (!isDragging) {
            clearTimeout(touchTimeoutRef.current);
            return;
          }
          
          e.preventDefault();
          const touch = e.touches[0];
          
          // Move drag image
          if (dragImageRef.current) {
            dragImageRef.current.style.left = `${touch.clientX - dragOffset.x}px`;
            dragImageRef.current.style.top = `${touch.clientY - dragOffset.y}px`;
          }
          
          // Check drop zones
          const element = document.elementFromPoint(touch.clientX, touch.clientY);
          const dropZone = element?.closest('[data-drop-zone]');
          
          if (dropZone) {
            const zoneId = dropZone.getAttribute('data-drop-zone');
            if (zoneId && zoneId !== dragOverZone) {
              setDragOverZone(zoneId);
              const zone = dropZones.get(zoneId);
              zone?.onHover?.(draggedItem, zoneId);
            }
          } else if (dragOverZone) {
            setDragOverZone(null);
          }
        },
        
        onTouchEnd: (e: React.TouchEvent) => {
          clearTimeout(touchTimeoutRef.current);
          
          if (!isDragging) return;
          
          // Clean up drag image
          if (dragImageRef.current) {
            document.body.removeChild(dragImageRef.current);
            dragImageRef.current = null;
          }
          
          // Check for drop
          if (dragOverZone) {
            handleDrop(dragOverZone);
          } else {
            endDrag(false);
          }
        },
      } : {}),

      // Accessibility
      tabIndex: 0,
      role: 'button',
      'aria-grabbed': isDragging && draggedItem?.id === item.id,
      'aria-dropeffect': 'move',
      
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
          if (!isDragging) {
            startDrag(item);
          } else if (draggedItem?.id === item.id) {
            endDrag();
          }
        }
      },

      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none' as const,
        touchAction: config.enableTouch ? 'none' : 'auto',
      },
    };

    return handlers;
  }, [isDragging, draggedItem, dragOverZone, dragOffset, config, startDrag, endDrag, handleDrop, dropZones]);

  // Make element a drop zone
  const makeDropZone = useCallback((zone: DropZone) => {
    const handlers = {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        
        if (!draggedItem) return;
        
        // Check if can accept
        if (!zone.accepts.includes(draggedItem.type)) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
        
        if (zone.canDrop && !zone.canDrop(draggedItem)) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
        
        e.dataTransfer.dropEffect = 'move';
        
        if (dragOverZone !== zone.id) {
          setDragOverZone(zone.id);
          zone.onHover?.(draggedItem, zone.id);
        }
      },
      
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
      },
      
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        
        // Check if really leaving (not entering child)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX >= rect.right ||
          e.clientY < rect.top ||
          e.clientY >= rect.bottom
        ) {
          if (dragOverZone === zone.id) {
            setDragOverZone(null);
            zone.onHover?.(null, zone.id);
          }
        }
      },
      
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        handleDrop(zone.id);
      },

      'data-drop-zone': zone.id,
      'aria-dropeffect': draggedItem && zone.accepts.includes(draggedItem.type) ? 'move' : 'none',
      
      style: {
        position: 'relative' as const,
      },
    };

    return handlers;
  }, [draggedItem, dragOverZone, handleDrop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
      if (dragImageRef.current) {
        document.body.removeChild(dragImageRef.current);
      }
    };
  }, []);

  return {
    isDragging,
    draggedItem,
    dragOverZone,
    startDrag,
    endDrag,
    makeDraggable,
    makeDropZone,
    registerDropZone,
  };
}

// Sortable list hook
export function useSortableList<T extends { id: string }>(
  items: T[],
  onReorder: (items: T[]) => void,
  config?: DragAndDropConfig
) {
  const [localItems, setLocalItems] = useState(items);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    setDragOverIndex(index);
    
    // Reorder items
    const draggedItem = localItems[draggedIndex];
    const newItems = [...localItems];
    
    // Remove dragged item
    newItems.splice(draggedIndex, 1);
    
    // Insert at new position
    newItems.splice(index, 0, draggedItem);
    
    setLocalItems(newItems);
    setDraggedIndex(index);
  }, [draggedIndex, localItems]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null) {
      onReorder(localItems);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, localItems, onReorder]);

  const getSortableProps = useCallback((index: number) => ({
    draggable: true,
    onDragStart: () => handleDragStart(index),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      handleDragOver(index);
    },
    onDragEnd: handleDragEnd,
    style: {
      opacity: draggedIndex === index ? 0.5 : 1,
      transform: dragOverIndex === index ? 'scale(1.02)' : 'scale(1)',
      transition: 'all 0.2s ease',
      cursor: 'move',
    },
  }), [draggedIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragEnd]);

  return {
    items: localItems,
    isDragging: draggedIndex !== null,
    draggedIndex,
    dragOverIndex,
    getSortableProps,
  };
}