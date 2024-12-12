type WatcherFunction<T = unknown> = (oldValue: T, newValue: T) => unknown;
/**
 * Field decorator that calls a function when
 * the value of the property changes.
 *
 * @param watcherFunctionName The name of the function
 * to call when the value of the property changes.
 *
 * @example
 * ```
 * class MyElement extends FastElement {
 *   @observable('dataChanged')
 *   data: MyData
 *
 *    public dataChanged(oldValue: MyData, newValue: MyData) {
 *     console.log('data changed', oldValue, newValue)
 *    }
 * }
 * ```
 *
 * @returns A decorator function.
 */
export function observable<This extends HTMLElement>(watcherFunctionName: keyof Extract<This, WatcherFunction>) {
  return function (_: undefined, context: ClassFieldDecoratorContext<This>): void {
    context.addInitializer(function (this: This) {
      let value: unknown = Reflect.get(this, context.name);
      Reflect.defineProperty(this, context.name, {
        set(newValue: unknown) {
          if (value === newValue) {
            return;
          }
          const oldValue = value;
          value = newValue;

          const watcher = Reflect.get(this, watcherFunctionName) as WatcherFunction;
          watcher?.call(this, oldValue, newValue);
        },
        get() {
          return value;
        }
      });
    });
  };
}
