/// <reference types="node" />
import { EventEmitter } from 'node:events';
import type { TraceContext, TraceSpan, TraceOptions } from './types.js';
export declare class Tracer extends EventEmitter {
    #private;
    active: boolean;
    uuidGenerator: () => string;
    get endSpan(): (span: TraceSpan) => TraceSpan | undefined;
    get startSpan(): (name: string, parent?: TraceSpan | undefined) => TraceSpan;
    get trace(): <T>(name: string, fn: (ctx: TraceContext) => T | Promise<T>, options?: TraceOptions) => T | Promise<T>;
    getActiveSpan(): TraceSpan | undefined;
}
