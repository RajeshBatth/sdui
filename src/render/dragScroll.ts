import { useEffect, useRef, type RefObject } from 'react';
import { Platform } from 'react-native';

const DRAG_THRESHOLD = 4;
const FLICK_FRACTION = 0.15;
const SETTLE_MS = 250;

function animateScrollLeft(node: HTMLElement, to: number, done: () => void): () => void {
  const from = node.scrollLeft;
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / SETTLE_MS);
    node.scrollLeft = from + (to - from) * (1 - (1 - t) ** 3);
    if (t < 1) frame = requestAnimationFrame(tick);
    else done();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export interface DragScrollOptions {
  step?: number;
  snap?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

interface Scrollable {
  getScrollableNode?: () => unknown;
}

/** Web only: lets a mouse drag a horizontal ScrollView, settling on the nearest page when snapping. */
export function useWebDragScroll(ref: RefObject<unknown>, opts: DragScrollOptions = {}): void {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (ref.current as Scrollable | null)?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node || typeof node.addEventListener !== 'function') return;

    const baseSnap = node.style.scrollSnapType;
    node.style.cursor = 'grab';
    let pointer = -1;
    let startX = 0;
    let startLeft = 0;
    let moved = false;
    let suppressClick = false;
    let cancelSettle: (() => void) | undefined;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      pointer = e.pointerId;
      startX = e.clientX;
      startLeft = node.scrollLeft;
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        moved = true;
        cancelSettle?.();
        node.setPointerCapture?.(pointer);
        node.style.scrollSnapType = 'none';
        node.style.scrollBehavior = 'auto';
        node.style.cursor = 'grabbing';
        node.style.userSelect = 'none';
        latest.current.onDragStart?.();
      }
      node.scrollLeft = startLeft - dx;
      e.preventDefault();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = -1;
      if (!moved) return;
      suppressClick = true;
      node.releasePointerCapture?.(e.pointerId);
      node.style.cursor = 'grab';
      node.style.userSelect = '';
      const { step, snap } = latest.current;
      if (snap && step && step > 0) {
        const dx = e.clientX - startX;
        const from = startLeft / step;
        let page = Math.round(node.scrollLeft / step);
        if (Math.abs(dx) > step * FLICK_FRACTION && page === Math.round(from)) page += dx < 0 ? 1 : -1;
        const max = Math.max(0, Math.round((node.scrollWidth - node.clientWidth) / step));
        page = Math.max(0, Math.min(max, page));
        cancelSettle = animateScrollLeft(node, page * step, () => {
          node.style.scrollSnapType = baseSnap;
          cancelSettle = undefined;
        });
      } else {
        node.style.scrollSnapType = baseSnap;
      }
      latest.current.onDragEnd?.();
    };
    const click = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    };
    const dragstart = (e: DragEvent) => e.preventDefault();

    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('click', click, true);
    node.addEventListener('dragstart', dragstart);
    return () => {
      cancelSettle?.();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      node.removeEventListener('click', click, true);
      node.removeEventListener('dragstart', dragstart);
      node.style.cursor = '';
    };
  }, [ref]);
}
