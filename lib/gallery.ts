import { useSyncExternalStore } from "react";

let images: string[] = [];
const listeners = new Set<() => void>();

export function setGalleryImages(next: string[]) {
  images = next;
  listeners.forEach((l) => l());
}

export function useGalleryImages() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => images,
    () => images,
  );
}
