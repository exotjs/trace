export interface Context {
  activeSpan?: Span;
  addAttribute: (name: string, value: unknown) => void;
  addEvent: (text: string, attributes?: Attributes) => void;
  end: () => void;
  name: string;
  rootSpan?: Span;
}

export interface Span {
  attributes: Record<string, unknown>;
  children: Span[];
  duration: number;
  events: {
    attributes?: Attributes;
    time: number;
    text: string;
  }[];
  name: string;
  parent?: Span;
  start: number;
  toJSON: () => unknown;
}

export interface SpanOptions {
  attributes?: Attributes;
  onEnd?: (ctx: Context) => void;
}

export type Attributes = Record<string, unknown>;

export type TraceFunction<T = unknown> = (
  name: string,
  fn: (ctx: Context) => Promise<T> | T,
  options?: SpanOptions
) => Promise<T> | T;
