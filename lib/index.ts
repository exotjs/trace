import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  TraceContext,
  SpanOptions,
  Attributes,
  TraceSpan,
  TraceOptions,
  TraceSpanStatus,
} from './types.js';

export class Tracer extends EventEmitter {
  #als = new AsyncLocalStorage<TraceContext>();

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

  get setStatus() {
    return this.#setStatus.bind(this);
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
    if (this.active) {
      span.attributes[name] = value;
      this.emit('addAttribute', span, name, value);
    }
  }

  #addEvent(span: TraceSpan, text: string, attributes?: Attributes) {
    if (this.active) {
      span.events.push({
        attributes,
        text,
        time: this.#now(),
      });
      this.emit('addEvent', span, text, attributes);
    }
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
      setStatus: (status, attributes) =>
        ctx.activeSpan
          ? this.#setStatus(ctx.activeSpan, status, attributes)
          : void 0,
    } as TraceContext;
    return ctx;
  }

  #exec<T>(
    ctx: TraceContext,
    fn: (ctx: TraceContext) => Promise<T> | T,
    name: string,
    options: SpanOptions,
    onEnd?: (ctx: TraceContext) => void
  ) {
    const span = (ctx.activeSpan = this.#startSpan(
      name,
      options.parent || ctx.activeSpan
    ));
    if (!ctx.rootSpan) {
      ctx.rootSpan = span;
    }
    let result: Promise<T> | T | undefined = undefined;
    if (this.active && options.attributes) {
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
    span.duration = this.#now() - span.start;
    if (span.children.length) {
      for (const child of span.children) {
        if (child.duration === 0) {
          this.#endSpan(child);
        }
      }
    }
    if (this.active) {
      this.emit('endSpan', span);
    }
    if (span.parent) {
      return span.parent;
    }
  }

  #setStatus(
    span: TraceSpan,
    status: TraceSpanStatus,
    attributes?: Attributes
  ) {
    if (this.active) {
      span.status = status;
      if (attributes) {
        for (const key in attributes) {
          this.#addAttribute(span, key, attributes[key]);
        }
      }
      this.emit('setStatus', span, status, attributes);
    }
  }

  #startSpan(name: string, parent?: TraceSpan) {
    const span: TraceSpan = {
      attributes: {},
      children: [],
      duration: 0,
      events: [],
      name,
      parent,
      start: this.#now(),
      uuid: this.active && !parent ? this.uuidGenerator() : void 0,
      toJSON() {
        return {
          ...this,
          parent: void 0,
        };
      },
    };
    if (parent) {
      parent.children.push(span);
    }
    if (this.active) {
      this.emit('startSpan', span);
    }
    return span;
  }

  #trace<T>(
    name: string,
    fn: (ctx: TraceContext) => Promise<T> | T,
    options: TraceOptions = {}
  ) {
    let ctx = this.active
      ? this.#als.getStore()
      : this.#createTraceContext(name);
    if (!ctx) {
      ctx = this.#createTraceContext(name);
      return this.#als.run(ctx, () => {
        return this.#exec(ctx!, fn, name, options, options.onEnd);
      });
    }
    return this.#exec(ctx, fn, name, options, options.onEnd);
  }
}
