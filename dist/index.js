import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
export class Tracer extends EventEmitter {
    #als = new AsyncLocalStorage();
    active = true;
    uuidGenerator = randomUUID;
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
    #addAttribute(span, name, value) {
        if (this.active) {
            span.attributes[name] = value;
            this.emit('addAttribute', span, name, value);
        }
    }
    #addEvent(span, text, attributes) {
        if (this.active) {
            span.events.push({
                attributes,
                text,
                time: this.#now(),
            });
            this.emit('addEvent', span, text, attributes);
        }
    }
    #createTraceContext(name) {
        const ctx = {
            addAttribute: (name, value) => ctx.activeSpan
                ? this.#addAttribute(ctx.activeSpan, name, value)
                : void 0,
            addEvent: (text, attributes) => ctx.activeSpan
                ? this.#addEvent(ctx.activeSpan, text, attributes)
                : void 0,
            end: () => {
                if (ctx.activeSpan) {
                    ctx.activeSpan = this.#endSpan(ctx.activeSpan);
                }
            },
            name,
            setStatus: (status, attributes) => ctx.activeSpan
                ? this.#setStatus(ctx.activeSpan, status, attributes)
                : void 0,
        };
        return ctx;
    }
    #exec(ctx, fn, name, options, onEnd) {
        const span = (ctx.activeSpan = this.#startSpan(name, options.parent || ctx.activeSpan));
        if (!ctx.rootSpan) {
            ctx.rootSpan = span;
        }
        let result = undefined;
        if (options.attributes) {
            for (const key in options.attributes) {
                this.#addAttribute(span, key, options.attributes[key]);
            }
        }
        try {
            result = fn(ctx);
        }
        finally {
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
    #endSpan(span) {
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
    #setStatus(span, status, attributes) {
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
    #startSpan(name, parent) {
        const span = {
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
    #trace(name, fn, options = {}) {
        let ctx = this.active
            ? this.#als.getStore()
            : this.#createTraceContext(name);
        if (!ctx) {
            ctx = this.#createTraceContext(name);
            return this.#als.run(ctx, () => {
                return this.#exec(ctx, fn, name, options, options.onEnd);
            });
        }
        return this.#exec(ctx, fn, name, options, options.onEnd);
    }
}
