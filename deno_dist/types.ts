export interface TraceContext {
  activeSpan?: TraceSpan;
  addAttribute: (name: string, value: unknown) => void;
  addEvent: (text: string, attributes?: Attributes) => void;
  end: () => void;
  name: string;
  rootSpan: TraceSpan;
  setStatus: (status: TraceSpanStatus, attributes?: Attributes) => void;
}

export interface TraceSpanEvent {
  attributes?: Attributes;
  time: number;
  text: string;
}

export interface TraceSpan {
  attributes: Attributes;
  children: TraceSpan[];
  duration: number;
  events: TraceSpanEvent[];
  name: string;
  parent?: TraceSpan;
  start: number;
  status?: TraceSpanStatus;
  uuid?: string;
  toJSON?: () => unknown;
}

export interface SpanOptions {
  attributes?: Attributes;
  parent?: TraceSpan;
}

export interface TraceOptions extends SpanOptions {
  onEnd?: (ctx: TraceContext) => void;
}

export type Attributes = Record<string, unknown>;

export type TraceFunction<T = unknown> = (
  name: string,
  fn: (ctx: TraceContext) => Promise<T> | T,
  options?: SpanOptions
) => Promise<T> | T;

export enum TraceSpanStatus {
  ERROR = 'error',
  OK = 'ok',
}
