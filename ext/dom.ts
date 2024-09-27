import type { ByID } from '../recordManager.model';
import { nullishFilter, objectFilter, type WithStringUnion } from './index';
import {
  type Ref,
  type WatchCallback,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';

const isValidWatchResponse = ([newValue, oldValue, _onCleanup]: Parameters<WatchCallback>) =>
  !!newValue && !oldValue && newValue !== oldValue;

/** Not needed after Vue 3.4 */
export const watchOnce = (
  value: Parameters<WatchCallback>[0],
  callback: (...args: Parameters<WatchCallback>) => void,
) => {
  const unwatch = watch(value, (newValue, oldValue, onCleanup) => {
    if (isValidWatchResponse([newValue, oldValue, onCleanup])) {
      callback(newValue, oldValue, onCleanup);
      try {
        unwatch();
      } catch (e) {
        //
      }
    }
  }, { immediate: true });
};

export const useElementDimensions = (element: Ref<Element | null>) => {
  const width = ref<number>(0);
  const height = ref<number>(0);

  const initObserver = () => {
    const resizeObserver = new ResizeObserver((entries) => {
      const firstEntry = entries[0];
      if (!firstEntry) return;
      width.value = firstEntry.contentRect.width;
      height.value = firstEntry.contentRect.height;
    });
    if (element.value) {
      resizeObserver.observe(element.value);
    }
  };

  /** Make sure the observer is initialized only after the element is rendered */
  watchOnce(element, () => {
    initObserver();
  });

  return { height, width };
};

type BySelector<T> = ByID<T>
export const useElementChildren = (element: Ref<Element | null>, childSelectors: string[]) => {
  const children = ref<BySelector<Element>>({});

  const checkForChildren = () => {
    if (!element.value) return;
    children.value = objectFilter(
      Object.fromEntries(
        childSelectors.map((selector) => [
          selector,
          element.value?.querySelector(selector),
        ]),
      ),
      nullishFilter,
    );
  };

  const initObserver = () => {
    const mutationObserver = new MutationObserver(checkForChildren);
    if (!element.value) return;
    mutationObserver.observe(element.value, { childList: true, subtree: true });
  };

  /** Make sure the observer is initialized only after the element is rendered */
  watchOnce(element, () => {
    initObserver();
  });

  return { children };
};

type MediaQueryShorthand = 'mobile' | 'tablet' | 'desktop';

const mediaQueries: Record<MediaQueryShorthand, string> = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
};

/**
 * Watch a media query.
 *
 * @param query - A media query string or a shorthand query.
 * @returns A ref that tracks the media query match status.
 */
export const useMediaQuery = (query: WithStringUnion<MediaQueryShorthand>) => {
  const matches = ref<boolean>(false);

  const mediaQueryString = mediaQueries[query as MediaQueryShorthand] ?? query;

  const updateMatches = () => {
    matches.value = window.matchMedia(mediaQueryString).matches;
  };

  onMounted(() => {
    updateMatches();
    window.addEventListener('resize', updateMatches);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateMatches);
  });

  return { matches };
};

/**
 * Watch the height of an element. The element must have rendered prior to
 * calling this, running this within onMounted is suggested.
 */
export const useElementHeight = (
  /** Selector for `document.querySelector` to find the first matching element. */
  selector: string,
) => {
  const elementHeight = ref(0);

  const resizeObserver = new ResizeObserver((entries) => {
    const firstEntry = entries[0];
    if (!firstEntry) {
      console.error(
        `Unable to watch height of ${selector} due to missing data.`,
      );
      return;
    }
    if (firstEntry.borderBoxSize || firstEntry.contentRect) {
      /** Includes padding */
      const borderBoxHeight = firstEntry.borderBoxSize[0]?.blockSize;
      /** Fallback for older browsers, excludes padding */
      const contentRectHeight = firstEntry.contentRect.height;
      elementHeight.value = borderBoxHeight ?? contentRectHeight;
    }
  });

  const element = document.querySelector(selector);
  if (element) {
    resizeObserver.observe(element);
  }

  return { elementHeight, disconnect: resizeObserver.disconnect };
};

/**
 * Watch the height of the navbar. The element must have rendered prior to
 * calling this, running this within onMounted is suggested. NavBar must have
 * `data-is-navbar` attribute if no alternative selector passed.
 */
export const useNavBarHeight = (selector = '[data-is-navbar]') => {
  const { elementHeight: navBarHeight, disconnect } = useElementHeight(selector);

  /**
   * Watch NavBar height (including header if applicable), and adjust content
   * margin so that content sits directly under NavBar.
   *
   * Place this in onMounted to ensure the initial adjustment works.
   * use syncContentTopWithNavBarHeight for sticky content.
   */
  const syncContentMarginWithNavBarHeight = (
    contentElement: Ref<HTMLElement | null>,
    isVisibleOverride?: Ref<boolean | null>,
  ) => watch(
    [
      () => navBarHeight.value,
      () => isVisibleOverride?.value,
    ],
    () => {
      const contentElementStyle = contentElement.value?.style;
      if (contentElementStyle && navBarHeight.value) {
        const navHeight = isVisibleOverride?.value === false ? 0 : navBarHeight.value;
        contentElementStyle.marginTop = `${navHeight}px`;
      }
    },
    { immediate: true },
  );

  const syncContentTopWithNavBarHeight = (
    contentElement: Ref<HTMLElement | null>,
    isVisibleOverride?: Ref<boolean | null>,
  ) => watch(
    [
      () => navBarHeight.value,
      () => isVisibleOverride?.value,
    ],
    () => {
      const contentElementStyle = contentElement.value?.style;
      if (contentElementStyle && navBarHeight.value) {
        const navHeight = isVisibleOverride?.value === false ? 0 : navBarHeight.value;
        contentElementStyle.top = `${navHeight}px`;
      }
    },
    { immediate: true },
  );

  /** Maximize view height to fill remaining space under NavBar */
  const syncContentHeightWithNavBarHeight = (
    contentElement: Ref<HTMLElement | null>,
    isVisibleOverride?: Ref<boolean | null>,
  ) => watch(
    [
      () => navBarHeight.value,
      () => isVisibleOverride?.value,
    ],
    () => {
      const contentElementStyle = contentElement.value?.style;
      if (contentElementStyle && navBarHeight.value) {
        const navHeight = isVisibleOverride?.value === false ? 0 : navBarHeight.value;
        contentElementStyle.height = `calc(100vh - ${navHeight}px)`;
      }
    },
    { immediate: true },
  );

  return {
    disconnect,
    navBarHeight,
    syncContentHeightWithNavBarHeight,
    syncContentMarginWithNavBarHeight,
    syncContentTopWithNavBarHeight,
  };
};

/**
 * Watch the height of FixedFooterButton. The element must have rendered prior
 * to calling this, running this within onMounted is suggested.
 *
 * Currently only supports Header with `globalFooter: true`. Potential future
 * improvement could be to watch for addition/removal of FixedFooterButton or
 * to always render FixedFooterButton at 0 height when Header is rendered, to
 * add support for `mobileFooter: true`.
 */
export const useFooterHeight = (selector = '[data-is-footer]') => {
  const { elementHeight: footerHeight, disconnect } = useElementHeight(selector);

  /**
   * Watch NavBar height (including header if applicable), and adjust content
   * margin so that content sits directly under NavBar.
   *
   * Place this in onMounted to ensure the initial adjustment works.
   * use syncContentTopWithNavBarHeight for sticky content.
   */
  const syncContentPaddingWithFooterHeight = (
    contentElement: Ref<HTMLElement | null>,
    additionalPadding = 0,
  ) => watch(
    () => footerHeight.value,
    () => {
      const contentElementStyle = contentElement.value?.style;
      if (contentElementStyle && footerHeight.value) {
        const padding = footerHeight.value + additionalPadding;
        contentElementStyle.paddingBottom = `${padding}px`;
      }
    },
    { immediate: true },
  );

  return {
    disconnect,
    footerHeight,
    syncContentPaddingWithFooterHeight,
  };
};

/**
 * Composable to check if an element is in view.
 * @param options IntersectionObserver options
 * @returns An object with a ref to be assigned to the target element, and a boolean ref indicating if the element is in view
 */
export const useInView = (
  targetRef: Ref<HTMLElement | null>,
  options: IntersectionObserverInit = {},
) => {
  const isInView = ref(false);

  let observer: IntersectionObserver | null = null;

  const unwatch = watch(targetRef, () => {
    observer = new IntersectionObserver(([entry]) => {
      isInView.value = entry.isIntersecting;
    }, options);

    if (targetRef.value) {
      observer.observe(targetRef.value);
    }
  });

  return {
    isInView,
    unwatch,
  };
};
