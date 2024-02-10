import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  Context,
  SpanOptions,
  Attributes,
  Span,
} from './types.js';

export class Tracer extends EventEmitter {
  #als = new AsyncLocalStorage<Context>();

  #mockContext: Context = {
    addAttribute: () => {},
    addEvent: () => {},
    end: () => {},
    name: '',
  };

  active: boolean = true;

  get trace(): (typeof this)['traceFn'] {
    return this.traceFn.bind(this);
  }

  endSpan(ctx: Context, span: Span, onEnd?: (ctx: Context) => void) {
    span.duration = this.#now() - span.start;
    if (onEnd) {
      onEnd(ctx);
    }
    this.emit('endSpan', span);
    if (span.parent) {
      return span.parent;
    }
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

  startSpan(ctx: Context, name: string, parent?: Span) {
    const span: Span = {
      attributes: {},
      children: [],
      duration: 0,
      events: [],
      name,
      parent,
      start: this.#now(),
      uuid: !parent ? randomUUID() : void 0,
      toJSON() {
        return {
          ...this,
          parent: void 0,
        };
      }
    };
    if (parent) {
      parent.children.push(span);
    } else {
      ctx.rootSpan = span;
    }
    this.emit('startSpan', span);
    return span;
  }

  traceFn<T>(
    name: string,
    fn: (ctx: Context) => Promise<T> | T,
    options: SpanOptions = {}
  ) {
    if (!this.active) {
      return fn(this.#mockContext);
    }
    let ctx = this.#als.getStore();
    if (!ctx) {
      ctx = this.#createContext(name, options);
      return this.#als.run(ctx, () => {
        return this.#exec(ctx!, fn, name, options);
      });
    }
    return this.#exec(ctx, fn, name, options);
  }

  #addAttribute(span: Span, name: string, value: unknown) {
    span.attributes[name] = value;
    this.emit('addAttribute', span, name, value);
  }

  #addEvent(span: Span, text: string, attributes?: Attributes) {
    span.events.push({
      attributes,
      text,
      time: this.#now(),
    });
    this.emit('addEvent', span, text, attributes);
  }

  #createContext(name: string, options: SpanOptions) {
    const ctx: Context = {
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
          ctx.activeSpan = this.endSpan(ctx, ctx.activeSpan, options.onEnd);
        }
      },
      name,
    };
    return ctx;
  }

  #exec<T>(
    ctx: Context,
    fn: (ctx: Context) => Promise<T> | T,
    name: string,
    options: SpanOptions
  ) {
    const span = (ctx.activeSpan = this.startSpan(ctx, name, ctx.activeSpan));
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
          ctx.activeSpan = this.endSpan(ctx, span, options.onEnd);
        });
      }
      ctx.activeSpan = this.endSpan(ctx, span, options.onEnd);
    }
    return result;
  }

  #now() {
    return performance.timeOrigin + performance.now();
  }
}
