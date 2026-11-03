export type EventMap = object;
export type EventHandler<T> = (payload: T) => void;

export class Bus<Events extends EventMap> {
  readonly #listeners = new Map<
    keyof Events,
    Set<EventHandler<Events[keyof Events]>>
  >();

  on<Key extends keyof Events>(
    event: Key,
    handler: EventHandler<Events[Key]>
  ): () => void {
    let listeners = this.#listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(event, listeners);
    }

    // reconnects event payload types lost to map erasure
    const listener = handler as EventHandler<Events[keyof Events]>;
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.#listeners.delete(event);
    };
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    const listeners = this.#listeners.get(event);
    if (!listeners) return;

    for (const listener of listeners) {
      listener(payload);
    }
  }
}
