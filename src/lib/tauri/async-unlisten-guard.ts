type UnlistenFn = () => void;

export function createAsyncUnlistenGuard() {
  let disposed = false;
  const unlisteners: UnlistenFn[] = [];

  return {
    add(unlisten: UnlistenFn) {
      if (disposed) {
        unlisten();
        return;
      }

      unlisteners.push(unlisten);
    },
    cleanup() {
      disposed = true;
      while (unlisteners.length > 0) {
        unlisteners.pop()?.();
      }
    },
  };
}
