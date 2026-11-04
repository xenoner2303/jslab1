export type RejectionReason =
  | "unauthorized_origin"
  | "ip_limit_exceeded"
  | "rate_limit_exceeded"
  | "join_timeout"
  | "invalid_message_schema"
  | "invalid_json"
  | "invalid_binary"
  | "binary_not_enabled"
  | "binary_input_required"
  | "room_not_found"
  | "room_full"
  | "already_joined"
  | "not_in_room";

export function calculatePercentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[index] ?? 0;
}

class MetricsCollector {
  #messagesIn = 0;
  #messagesOut = 0;
  #bytesIn = 0;
  #bytesOut = 0;

  #prevMessagesIn = 0;
  #prevMessagesOut = 0;
  #prevBytesIn = 0;
  #prevBytesOut = 0;

  #rateMessagesIn = 0;
  #rateMessagesOut = 0;
  #rateBytesIn = 0;
  #rateBytesOut = 0;

  #rejections = new Map<RejectionReason, number>();
  #rateInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.#rateInterval = setInterval(() => this.#updateRates(), 1000);
    this.#rateInterval.unref?.();
  }

  #updateRates(): void {
    this.#rateMessagesIn = this.#messagesIn - this.#prevMessagesIn;
    this.#rateMessagesOut = this.#messagesOut - this.#prevMessagesOut;
    this.#rateBytesIn = this.#bytesIn - this.#prevBytesIn;
    this.#rateBytesOut = this.#bytesOut - this.#prevBytesOut;

    this.#prevMessagesIn = this.#messagesIn;
    this.#prevMessagesOut = this.#messagesOut;
    this.#prevBytesIn = this.#bytesIn;
    this.#prevBytesOut = this.#bytesOut;
  }

  recordMessageIn(bytes: number): void {
    this.#messagesIn += 1;
    this.#bytesIn += Math.max(0, bytes);
  }

  recordMessageOut(bytes: number): void {
    this.#messagesOut += 1;
    this.#bytesOut += Math.max(0, bytes);
  }

  recordRejection(reason: RejectionReason): void {
    this.#rejections.set(reason, (this.#rejections.get(reason) ?? 0) + 1);
  }

  getSnapshot(): {
    messagesIn: number;
    messagesOut: number;
    bytesIn: number;
    bytesOut: number;
    messagesPerSecondIn: number;
    messagesPerSecondOut: number;
    bytesPerSecondIn: number;
    bytesPerSecondOut: number;
    rejections: Record<RejectionReason, number>;
  } {
    const rejectionsObj = {} as Record<RejectionReason, number>;
    const allReasons: RejectionReason[] = [
      "unauthorized_origin",
      "ip_limit_exceeded",
      "rate_limit_exceeded",
      "join_timeout",
      "invalid_message_schema",
      "invalid_json",
      "invalid_binary",
      "binary_not_enabled",
      "binary_input_required",
      "room_not_found",
      "room_full",
      "already_joined",
      "not_in_room",
    ];
    for (const reason of allReasons) {
      rejectionsObj[reason] = this.#rejections.get(reason) ?? 0;
    }

    return {
      messagesIn: this.#messagesIn,
      messagesOut: this.#messagesOut,
      bytesIn: this.#bytesIn,
      bytesOut: this.#bytesOut,
      messagesPerSecondIn: this.#rateMessagesIn,
      messagesPerSecondOut: this.#rateMessagesOut,
      bytesPerSecondIn: this.#rateBytesIn,
      bytesPerSecondOut: this.#rateBytesOut,
      rejections: rejectionsObj,
    };
  }

  renderPrometheus(params: {
    totalRooms: number;
    totalPlayers: number;
    tickTimeP99Ms: number;
    rssBytes: number;
    eventLoopUtilization: number;
  }): string {
    const snapshot = this.getSnapshot();

    const lines: string[] = [
      `# HELP game_active_players Total active players`,
      `# TYPE game_active_players gauge`,
      `game_active_players ${params.totalPlayers}`,

      `# HELP game_active_rooms Total active rooms`,
      `# TYPE game_active_rooms gauge`,
      `game_active_rooms ${params.totalRooms}`,

      `# HELP game_tick_duration_p99_ms 99th percentile tick duration in ms`,
      `# TYPE game_tick_duration_p99_ms gauge`,
      `game_tick_duration_p99_ms ${Number(params.tickTimeP99Ms.toFixed(3))}`,

      `# HELP game_messages_total Total messages transferred`,
      `# TYPE game_messages_total counter`,
      `game_messages_total{direction="in"} ${snapshot.messagesIn}`,
      `game_messages_total{direction="out"} ${snapshot.messagesOut}`,

      `# HELP game_messages_per_second Messages transferred per second`,
      `# TYPE game_messages_per_second gauge`,
      `game_messages_per_second{direction="in"} ${snapshot.messagesPerSecondIn}`,
      `game_messages_per_second{direction="out"} ${snapshot.messagesPerSecondOut}`,

      `# HELP game_bytes_total Total bytes transferred`,
      `# TYPE game_bytes_total counter`,
      `game_bytes_total{direction="in"} ${snapshot.bytesIn}`,
      `game_bytes_total{direction="out"} ${snapshot.bytesOut}`,

      `# HELP game_bytes_per_second Bytes transferred per second`,
      `# TYPE game_bytes_per_second gauge`,
      `game_bytes_per_second{direction="in"} ${snapshot.bytesPerSecondIn}`,
      `game_bytes_per_second{direction="out"} ${snapshot.bytesPerSecondOut}`,

      `# HELP game_rejections_total Total rejected connections or frames by reason`,
      `# TYPE game_rejections_total counter`,
    ];

    for (const [reason, count] of Object.entries(snapshot.rejections)) {
      lines.push(`game_rejections_total{reason="${reason}"} ${count}`);
    }

    lines.push(
      `# HELP process_rss_bytes Resident set size memory in bytes`,
      `# TYPE process_rss_bytes gauge`,
      `process_rss_bytes ${params.rssBytes}`,

      `# HELP process_event_loop_utilization Event loop utilization ratio`,
      `# TYPE process_event_loop_utilization gauge`,
      `process_event_loop_utilization ${Number(params.eventLoopUtilization.toFixed(4))}`,
    );

    return lines.join("\n") + "\n";
  }
}

export const metrics = new MetricsCollector();
