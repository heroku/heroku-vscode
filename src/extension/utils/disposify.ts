export function disposify<T extends { dispose: () => void }>(disposable: T): T & Disposable {
  return new Proxy(disposable, {
    get(target: T, p: Extract<string | symbol, keyof (T | Disposable)>): unknown {
      if (p === Symbol.dispose) {
        return Reflect.get(target, 'dispose');
      }
      return Reflect.get(target, p);
    }
  }) as T & Disposable;
}
