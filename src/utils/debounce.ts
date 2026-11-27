// 极简防抖：连续调用只在最后一次调用后 wait 毫秒执行一次。
// 返回的函数带有 cancel()，页面 onUnload 时用于清理定时器。
export interface Debounced<A extends any[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends any[]>(fn: (...args: A) => void, wait: number): Debounced<A> {
  let timer: any = null;
  let lastArgs: A | null = null;
  const wrapped = ((...args: A) => {
    lastArgs = args;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }, wait);
  }) as Debounced<A>;
  wrapped.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      lastArgs = null;
    }
  };
  wrapped.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }
  };
  return wrapped;
}
