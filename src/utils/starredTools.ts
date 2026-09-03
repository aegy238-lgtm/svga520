import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'svga_starred_tools';
const EVENT_NAME = 'svga_starred_tools_updated';

// Default initial starred tools if user has never set preferences
const DEFAULT_STARRED_TOOLS: string[] = ['svga-layer-editor', 'svga-compressor'];

/**
 * Get the current list of starred tool IDs from localStorage
 */
export function getStarredToolIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // First-time setup: save defaults so they are persisted
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STARRED_TOOLS));
      return DEFAULT_STARRED_TOOLS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_STARRED_TOOLS;
  } catch (err) {
    console.error('Failed to read starred tools from localStorage:', err);
    return DEFAULT_STARRED_TOOLS;
  }
}

/**
 * Save the list of starred tool IDs to localStorage and notify listeners
 */
export function setStarredToolIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: ids }));
  } catch (err) {
    console.error('Failed to save starred tools to localStorage:', err);
  }
}

/**
 * Check whether a tool is starred
 */
export function isToolStarred(toolId: string): boolean {
  const current = getStarredToolIds();
  return current.includes(toolId);
}

/**
 * Toggle star status for a tool ID
 * Returns the new starred state
 */
export function toggleStarTool(toolId: string): boolean {
  const current = getStarredToolIds();
  let updated: string[];
  let newState: boolean;

  if (current.includes(toolId)) {
    updated = current.filter(id => id !== toolId);
    newState = false;
  } else {
    // Add to the front so recently starred tools appear immediately at the beginning
    updated = [toolId, ...current.filter(id => id !== toolId)];
    newState = true;
  }

  setStarredToolIds(updated);
  return newState;
}

/**
 * Star a tool ID
 */
export function starTool(toolId: string): void {
  const current = getStarredToolIds();
  if (!current.includes(toolId)) {
    setStarredToolIds([toolId, ...current]);
  }
}

/**
 * Unstar a tool ID
 */
export function unstarTool(toolId: string): void {
  const current = getStarredToolIds();
  if (current.includes(toolId)) {
    setStarredToolIds(current.filter(id => id !== toolId));
  }
}

/**
 * Custom React Hook for managing starred/pinned tools reactively
 */
export function useStarredTools() {
  const [starredToolIds, setStarred] = useState<string[]>(() => getStarredToolIds());

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setStarred(customEvent.detail);
      } else {
        setStarred(getStarredToolIds());
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        setStarred(getStarredToolIds());
      }
    });

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
    };
  }, []);

  const isStarred = useCallback((id: string) => starredToolIds.includes(id), [starredToolIds]);

  const toggle = useCallback((id: string) => {
    return toggleStarTool(id);
  }, []);

  return {
    starredToolIds,
    isStarred,
    toggleStar: toggle,
    starTool,
    unstarTool,
    setStarredToolIds
  };
}
