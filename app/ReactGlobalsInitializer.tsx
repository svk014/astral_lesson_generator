'use client';

import { useEffect } from 'react';
import { initializeReactGlobals } from '@/lib/globals-init';

export function ReactGlobalsInitializer() {
  useEffect(() => {
    initializeReactGlobals().catch(err => {
      console.error('Failed to initialize React globals:', err);
    });
  }, []);

  return null;
}
