import { useEffect } from 'react';

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

export const registerBackHandler = (handler: BackHandler) => {
  handlers.push(handler);
};

export const unregisterBackHandler = (handler: BackHandler) => {
  const index = handlers.indexOf(handler);
  if (index !== -1) handlers.splice(index, 1);
};

let trapInitialized = false;

export const initBackTrap = () => {
  if (trapInitialized) return;
  trapInitialized = true;
  
  // Push initial state to trap the back button
  window.history.pushState({ appTrap: true }, '', window.location.href);
  
  window.addEventListener('popstate', (e) => {
    // Push state again to maintain the trap
    window.history.pushState({ appTrap: true }, '', window.location.href);
    
    // Execute handlers from top of stack to bottom (LIFO)
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i]()) {
        return; // Handled by this handler
      }
    }
  });
};
