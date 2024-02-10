/// <reference types="node" />
import { EventEmitter } from 'node:events';
import type { Context, SpanOptions, Span } from './types.js';
export declare class Tracer extends EventEmitter {
    #private;
    active: boolean;
    get trace(): (typeof this)['traceFn'];
    endSpan(ctx: Context, span: Span, onEnd?: (ctx: Context) => void): Span | undefined;
    getActiveSpan(): Span | undefined;
    startSpan(ctx: Context, name: string, parent?: Span): Span;
    traceFn<T>(name: string, fn: (ctx: Context) => Promise<T> | T, options?: SpanOptions): T | Promise<T>;
}
