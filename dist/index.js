import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
export class Tracer extends EventEmitter {
    #als = new AsyncLocalStorage();
    #mockContext = {
        addAttribute: () => { },
        addEvent: () => { },
        end: () => { },
        name: '',
    };
    active = true;
    get trace() {
        return this.traceFn.bind(this);
    }
    endSpan(ctx, span, onEnd) {
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
    startSpan(ctx, name, parent) {
        const span = {
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
        }
        else {
            ctx.rootSpan = span;
        }
        this.emit('startSpan', span);
        return span;
    }
    traceFn(name, fn, options = {}) {
        if (!this.active) {
            return fn(this.#mockContext);
        }
        let ctx = this.#als.getStore();
        if (!ctx) {
            ctx = this.#createContext(name, options);
            return this.#als.run(ctx, () => {
                return this.#exec(ctx, fn, name, options);
            });
        }
        return this.#exec(ctx, fn, name, options);
    }
    #addAttribute(span, name, value) {
        span.attributes[name] = value;
        this.emit('addAttribute', span, name, value);
    }
    #addEvent(span, text, attributes) {
        span.events.push({
            attributes,
            text,
            time: this.#now(),
        });
        this.emit('addEvent', span, text, attributes);
    }
    #createContext(name, options) {
        const ctx = {
            addAttribute: (name, value) => ctx.activeSpan
                ? this.#addAttribute(ctx.activeSpan, name, value)
                : void 0,
            addEvent: (text, attributes) => ctx.activeSpan
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
    #exec(ctx, fn, name, options) {
        const span = (ctx.activeSpan = this.startSpan(ctx, name, ctx.activeSpan));
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
