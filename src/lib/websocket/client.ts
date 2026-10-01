import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "./messages";

export type RealtimeState = "idle" | "connecting" | "open" | "reconnecting";

type Handler = (message: ServerMessage) => void;
type StateHandler = (state: RealtimeState) => void;

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * The realtime connection.
 *
 * Deliberately not a React thing: a socket outlives any component, and reconnect
 * logic that runs inside an effect ends up racing Strict Mode's double-invoke.
 * Components talk to it through `useRealtime`.
 *
 * Responsibilities: connect, reconnect with backoff, heartbeat, and keep a
 * reference-counted set of topics so the last component to leave an event
 * unsubscribes it — and so every topic is re-sent after a reconnect.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private state: RealtimeState = "idle";
  private handlers = new Set<Handler>();
  private stateHandlers = new Set<StateHandler>();
  /** topic → how many components currently want it. */
  private topicCounts = new Map<string, number>();
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUs = false;

  constructor(private readonly url: string) {}

  getState(): RealtimeState {
    return this.state;
  }

  onMessage(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  connect(): void {
    if (typeof window === "undefined") return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;

    this.closedByUs = false;
    this.setState(this.attempt === 0 ? "connecting" : "reconnecting");

    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.attempt = 0;
      this.setState("open");
      // A reconnect starts with no server-side subscriptions, so restate them.
      const topics = [...this.topicCounts.keys()];
      if (topics.length) this.send({ type: "SUBSCRIBE", topics });
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      const message = parseServerMessage(String(event.data));
      // A malformed frame is dropped, not fatal.
      if (message) for (const handler of this.handlers) handler(message);
    };

    this.socket.onclose = () => {
      this.stopHeartbeat();
      if (!this.closedByUs) this.scheduleReconnect();
    };

    this.socket.onerror = () => this.socket?.close();
  }

  disconnect(): void {
    this.closedByUs = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setState("idle");
  }

  /**
   * Registers interest in topics and returns the matching release.
   *
   * Reference counted: two components watching the same event share one server
   * subscription, and it is dropped when the second one leaves.
   */
  subscribe(topics: string[]): () => void {
    const added: string[] = [];
    for (const topic of topics) {
      const count = this.topicCounts.get(topic) ?? 0;
      this.topicCounts.set(topic, count + 1);
      if (count === 0) added.push(topic);
    }
    if (added.length) this.send({ type: "SUBSCRIBE", topics: added });

    return () => {
      const removed: string[] = [];
      for (const topic of topics) {
        const count = this.topicCounts.get(topic) ?? 0;
        if (count <= 1) {
          this.topicCounts.delete(topic);
          removed.push(topic);
        } else {
          this.topicCounts.set(topic, count - 1);
        }
      }
      if (removed.length) this.send({ type: "UNSUBSCRIBE", topics: removed });
    };
  }

  /** Feeds a message in as if it had arrived — used by the dev simulator. */
  inject(message: ServerMessage): void {
    for (const handler of this.handlers) handler(message);
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private setState(state: RealtimeState): void {
    if (this.state === state) return;
    this.state = state;
    for (const handler of this.stateHandlers) handler(state);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(
      () => this.send({ type: "PING" }),
      HEARTBEAT_MS,
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.setState("reconnecting");

    // Exponential backoff with jitter, so a gateway restart does not bring the
    // whole user base back in one synchronised wave.
    const base = Math.min(1000 * 2 ** this.attempt, MAX_BACKOFF_MS);
    const delay = base / 2 + Math.random() * (base / 2);
    this.attempt++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
