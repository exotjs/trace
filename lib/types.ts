export interface TraceContext {
  activeSpan?: TraceSpan;
  addAttribute: (name: string, value: unknown) => void;
  addEvent: (text: string, attributes?: Attributes) => void;
  end: () => void;
  name: string;
  rootSpan?: TraceSpan;
}

export interface TraceSpan {
  attributes: Attributes;
  children: TraceSpan[];
  duration: number;
  events: {
    attributes?: Attributes;
    time: number;
    text: string;
  }[];
  name: string;
  parent?: TraceSpan;
  start: number;
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
