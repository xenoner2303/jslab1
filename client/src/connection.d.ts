export class GameConnection extends EventTarget {
  constructor(url: string);
  send(data: unknown): boolean;
  connect(): void;
  close(): void;
}
