import React, { ComponentType, lazy, Suspense } from 'react';
import { LazyLoadFallback } from '@/components/common/LazyLoadFallback';

/**
 * Utility to create lazy-loaded components with Suspense boundary
 * This helps reduce initial bundle size by code-splitting heavy screens
 *
 * @param importFunc - Dynamic import function that returns the component
 * @param fallbackMessage - Optional custom loading message
 * @returns Lazy-loaded component wrapped in Suspense
 *
 * @example
 * const ProductsScreen = lazyLoad(() => import('@/screens/Inventory/ProductsScreen'));
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallbackMessage?: string
): React.FC<React.ComponentProps<T>> {
  const LazyComponent = lazy(importFunc);

  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={<LazyLoadFallback message={fallbackMessage} />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * Preload a lazy-loaded component
 * Useful for prefetching screens the user is likely to navigate to
 *
 * @example
 * // Preload when hovering over a button
 * onMouseEnter={() => preloadComponent(() => import('@/screens/Detail'))}
 */
export function preloadComponent(importFunc: () => Promise<any>): void {
  importFunc();
}
