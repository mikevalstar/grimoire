import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Distance from a virtual list's own top to the top of its scroll element's
 * content. TanStack uses this to compare document-relative item starts with
 * the scroll element's offset, while callers subtract it when positioning.
 */
export function useVirtualScrollMargin(
  listRef: RefObject<HTMLElement | null>,
  scrollElement: HTMLElement | null,
): number {
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !scrollElement) {
      setMargin(0);
      return;
    }

    const measure = () => {
      const next =
        list.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top +
        scrollElement.scrollTop;
      setMargin((current) => (Math.abs(current - next) < 0.5 ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [listRef, scrollElement]);

  return margin;
}
