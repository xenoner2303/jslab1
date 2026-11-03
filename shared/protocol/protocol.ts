import { z } from "zod";

export const JoinMessageSchema = z.object({
  type: z.literal("join"),
  room: z.string().min(1),
  name: z.string().min(1),
});

export const InputMessageSchema = z.object({
  type: z.literal("input"),
  seq: z.number().int().nonnegative(),
  tick: z.number().int().nonnegative(),
  thrust: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  turn: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  fire: z.boolean(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  JoinMessageSchema,
  InputMessageSchema,
]);

export type JoinMessage = z.infer<typeof JoinMessageSchema>;
export type ClientInputMessage = z.infer<typeof InputMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ParseResult<T> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

export function parseClientMessage(data: unknown): ParseResult<ClientMessage> {
  const result = ClientMessageSchema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.message;
    console.error("Invalid client message format:", errorMsg, data);
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data };
}
