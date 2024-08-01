import { EventEmitter } from 'node:stream';

export type Bindable<T extends object> = {
  [K in keyof T]: T[K];
} & PropertyChangeNotifier<T>;

export type PropertyChangedEventMap<T> = {
  [PropertyChangedEvent.PROPERTY_CHANGED]: PropertyChangedEvent<T>;
};

/**
 * The PropertyChangeNotifier is a concise
 * mechanism to listen for property changes
 * on an arbitrary object.
 *
 * When changes are detected, a PropertyChangedEvent
 * is dispatched with the old and new values. Subscribers
 * can then handle the property changes.
 *
 * @example
 * ```
 * const user = propertyChangeNotifierFactory({userName: 'john.doe', firstName: 'john', lastName: 'Doe'});
 * user.addListener(PropertyChangedEvent.PROPERTY_CHANGED, event => {
 *  const {prop, newValue, oldValue} = event;
 *  // Handle the change in a meaninful way
 * });
 *
 * user.firstName = 'John';
 * ```
 */
export class PropertyChangeNotifier<T extends object> extends EventEmitter implements ProxyHandler<T> {

  /**
   * Constructs a new PropertyChangeNotifier
   *
   * @param source The source object to proxy
   * @returns A Bindable object of type T
   */
  public constructor(public source: T) {
    super();
    const proxy = new Proxy(this.source, this);
    return proxy as PropertyChangeNotifier<T>;
  }

  /**
   * @inheritdoc
   */
  public addListener<K extends keyof PropertyChangedEventMap<T>>(eventName: K, listener: (event: PropertyChangedEventMap<T>[K]) => void): this {
    return super.addListener(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public on<K extends keyof PropertyChangedEventMap<T>>(eventName: K, listener: (event: PropertyChangedEventMap<T>[K]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public once<K extends keyof PropertyChangedEventMap<T>>(eventName: K, listener: (event: PropertyChangedEventMap<T>[K]) => void): this {
    return super.once(eventName, listener);
  }

  /**
   * @inheritdoc
   */
  public get(target: T, prop: string | symbol): unknown {
    if (prop in this) {
      return Reflect.get(this, prop);
    }
    return Reflect.get(target, prop);
  }

  /**
   * @inheritdoc
   */
  public set(target: T, prop: string | symbol, newValue: unknown): boolean {
    if (prop in this) {
      return Reflect.set(this, prop, newValue);
    }
    const oldValue = target[prop as keyof T];
    if (newValue === oldValue) {
      return true;
    }
    Reflect.set(target, prop, newValue);
    this.emit(PropertyChangedEvent.PROPERTY_CHANGED, new PropertyChangedEvent<T>(prop as keyof T, newValue, oldValue, target));
    return true;
  }

  /**
   * @inheritdoc
   */
  public deleteProperty(target: T, prop: string | symbol): boolean {
    const oldValue = target[prop as keyof T];
    const deleted = Reflect.deleteProperty(target, prop);
    return deleted ? this.emit(PropertyChangedEvent.PROPERTY_CHANGED, new PropertyChangedEvent<T>(prop as keyof T, undefined, oldValue, target)) : deleted;
  }
}

/**
 * The PropertyChangedEvent is the event object dispatched
 * in response to property changes on the target object.
 */
export class PropertyChangedEvent<T> extends Event {
  public static PROPERTY_CHANGED = 'propertyChanged' as const;

  /**
   * Constructs a new PropertyChangedEvent
   *
   * @param property The property that has changed.
   * @param newValue The new value assigned to the specifid property.
   * @param oldValue The old value prior to the change.
   * @param source The source object. This is the unproxied source object.
   */
  public constructor(public property: keyof T, public newValue: unknown, public oldValue: unknown, public source: T) {
    super(PropertyChangedEvent.PROPERTY_CHANGED, { cancelable: false });
  }
}
/**
 * Factory fuction used to proxy an object's property writes.
 *
 * @param target The object to listen for property changes on.
 * @returns The Bindable object which emits when property changes occur.
 */
export function propertyChangeNotifierFactory<T extends object>(target: T): Bindable<T> {
  return new PropertyChangeNotifier(target) as unknown as Bindable<T>;
}
