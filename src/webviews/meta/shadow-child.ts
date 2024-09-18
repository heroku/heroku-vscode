/**
 * Field decorator that accepts a query selector
 * to retrieve a child of the shadow dom.
 *
 * @example
 * ```
 * class MyElement extends FastElement {
 *   @shadowChild('.submit-button')
 *   button: HTMLButtonElement;
 * }
 * ```
 *
 * @returns A decorator function.
 */
export function shadowChild<This extends HTMLElement>(querySelector: string) {
  return function (_: undefined, context: ClassFieldDecoratorContext<This>): void {
    context.addInitializer(function (this: This) {
      let element: HTMLElement | undefined;
      Reflect.defineProperty(this, context.name, {
        get(this: This) {
          if (element === undefined) {
            element = this.shadowRoot!.querySelector(querySelector) as HTMLElement;
          }
          return element;
        }
      });
    });
  };
}
