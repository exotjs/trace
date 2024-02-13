import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  TraceContext,
  SpanOptions,
  Attributes,
  TraceSpan,
  TraceOptions,
} from './types.js';

export class Tracer extends EventEmitter {
  #als = new AsyncLocalStorage<TraceContext>();

  #mockTraceContext: TraceContext = {
    addAttribute: () => {},
    addEvent: () => {},
    end: () => {},
    name: '',
    rootSpan: void 0,
  } as any;

  #mockSpan: TraceSpan = {
    attributes: {},
    children: [],
    duration: 0,
    events: [],
    name: '',
    start: 0,
    toJSON() {
      return this;
    }
  };

  active: boolean = true;

  uuidGenerator: () => string = randomUUID;

  get addAttribute() {
    return this.#addAttribute.bind(this);
  }

  get addEvent() {
    return this.#addEvent.bind(this);
  }

  get endSpan() {
    return this.#endSpan.bind(this);
  }

  get startSpan() {
    return this.#startSpan.bind(this);
  }

  get trace() {
    return this.#trace.bind(this);
  }

  getActiveSpan() {
    if (!this.active) {
      return void 0;
    }
    const ctx = this.#als.getStore();
    if (ctx) {
      return ctx.activeSpan;
    }
  }

  #addAttribute(span: TraceSpan, name: string, value: unknown) {
    span.attributes[name] = value;
    this.emit('addAttribute', span, name, value);
  }

  #addEvent(span: TraceSpan, text: string, attributes?: Attributes) {
    span.events.push({
      attributes,
      text,
      time: this.#now(),
    });
    this.emit('addEvent', span, text, attributes);
  }

  #createTraceContext(name: string) {
    const ctx: TraceContext = {
      addAttribute: (name, value) =>
        ctx.activeSpan
          ? this.#addAttribute(ctx.activeSpan, name, value)
          : void 0,
      addEvent: (text, attributes) =>
        ctx.activeSpan
          ? this.#addEvent(ctx.activeSpan, text, attributes)
          : void 0,
      end: () => {
        if (ctx.activeSpan) {
          ctx.activeSpan = this.#endSpan(ctx.activeSpan);
        }
      },
      name,
    } as TraceContext;
    return ctx;
  }

  #exec<T>(
    ctx: TraceContext,
    fn: (ctx: TraceContext) => Promise<T> | T,
    name: string,
    options: SpanOptions,
    onEnd?: (ctx: TraceContext) => void,
  ) {
    const span = (ctx.activeSpan = this.#startSpan(name, options.parent || ctx.activeSpan));
    if (!ctx.rootSpan) {
      ctx.rootSpan = span;
    }
    let result: Promise<T> | T | undefined = undefined;
    if (options.attributes) {
      for (const key in options.attributes) {
        this.#addAttribute(span, key, options.attributes[key]);
      }
    }
    try {
      result = fn(ctx);
    } finally {
      if (result instanceof Promise) {
        // eslint-disable-next-line no-unsafe-finally
        return result.finally(() => {
          ctx.activeSpan = this.#endSpan(span);
          onEnd?.(ctx);
        });
      }
      ctx.activeSpan = this.#endSpan(span);
      onEnd?.(ctx);
    }
    return result;
  }

  #now() {
    return performance.timeOrigin + performance.now();
  }

  #endSpan(span: TraceSpan) {
    if (!this.active) {
      return void 0;
    }
    span.duration = this.#now() - span.start;
    if (span.children.length) {
      for (const child of span.children) {
        if (child.duration === 0) {
          this.#endSpan(child);
        }
      }
    }
    this.emit('endSpan', span);
    if (span.parent) {
      return span.parent;
    }
  }

  #startSpan(name: string, parent?: TraceSpan) {
    if (!this.active) {
      return this.#mockSpan;
    }
    const span: TraceSpan = {
      attributes: {},
      children: [],
      duration: 0,
      events: [],
      name,
      parent,
      start: this.#now(),
      uuid: !parent ? this.uuidGenerator() : void 0,
      toJSON() {
        return {
          ...this,
          parent: void 0,
        };
      }
    };
    if (parent) {
      parent.children.push(span);
    }
    this.emit('startSpan', span);
    return span;
  }

  #trace<T>(
    name: string,
    fn: (ctx: TraceContext) => Promise<T> | T,
    options: TraceOptions = {}
  ) {
    if (!this.active) {
      return fn(this.#mockTraceContext);
    }
    let ctx = this.#als.getStore();
    if (!ctx) {
      ctx = this.#createTraceContext(name);
      return this.#als.run(ctx, () => {
        return this.#exec(ctx!, fn, name, options, options.onEnd);
      });
    }
    return this.#exec(ctx, fn, name, options, options.onEnd);
  }
}
