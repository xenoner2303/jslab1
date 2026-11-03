import {
  BinaryMessageSchema,
  ProtocolMessageSchema,
  type BinaryMessage,
  type ProtocolMessage,
} from "../protocol.ts";
import {
  decodeBinaryMessage,
  encodeBinaryMessage,
} from "./binary.ts";
import { decodeJsonMessage, encodeJsonMessage } from "./json.ts";

export interface Codec {
  encode(message: ProtocolMessage | BinaryMessage): ArrayBuffer | string;
  decode(data: ArrayBuffer | ArrayBufferView | string): unknown;
}

export class JsonCodec implements Codec {
  encode(message: ProtocolMessage | BinaryMessage): string {
    const result = ProtocolMessageSchema.safeParse(message);
    if (!result.success) {
      throw new TypeError(`Invalid JSON message: ${result.error.message}`);
    }
    return encodeJsonMessage(result.data);
  }

  decode(data: ArrayBuffer | ArrayBufferView | string): unknown {
    if (typeof data !== "string" && ArrayBuffer.isView(data)) {
      return decodeJsonMessage(
        new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      );
    }
    if (typeof data !== "string") {
      throw new TypeError("JSON message must be a string or byte view");
    }
    return decodeJsonMessage(data);
  }

}

export class BinaryCodec implements Codec {
  encode(message: ProtocolMessage | BinaryMessage): ArrayBuffer {
    const result = BinaryMessageSchema.safeParse(message);
    if (!result.success) {
      throw new TypeError(
        `Message is not supported by the binary codec: ${result.error.message}`,
      );
    }
    return encodeBinaryMessage(result.data);
  }

  decode(data: ArrayBuffer | ArrayBufferView | string): BinaryMessage {
    if (typeof data === "string") {
      throw new TypeError("Binary message must be an ArrayBuffer or view");
    }
    return decodeBinaryMessage(data);
  }
}

export function getCodec(type: "json" | "binary"): Codec {
  switch (type) {
    case "json":
      return new JsonCodec();
    case "binary":
      return new BinaryCodec();
    default: {
      const _exhaustive: never = type;
      throw new TypeError(`Unsupported codec: ${_exhaustive}`);
    }
  }
}
