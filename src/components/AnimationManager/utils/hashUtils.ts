/**
 * Content Hash and Deduplication Engine
 * Uses Web Crypto API SHA-256 for secure, high-speed binary hashing.
 */

import { AnimationItem, DuplicateDetectionResult } from '../types';

export async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function checkDuplicate(
  hash: string,
  existingItems: AnimationItem[]
): DuplicateDetectionResult {
  const existingItem = existingItems.find(item => item.contentHash === hash);
  if (existingItem) {
    return {
      isDuplicate: true,
      existingItem,
      hash
    };
  }
  return {
    isDuplicate: false,
    hash
  };
}

/**
 * Filter out duplicates from an array of items by contentHash
 */
export function deduplicateItems(items: AnimationItem[]): AnimationItem[] {
  const seenHashes = new Set<string>();
  const uniqueItems: AnimationItem[] = [];

  for (const item of items) {
    if (!seenHashes.has(item.contentHash)) {
      seenHashes.add(item.contentHash);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}
