/// <reference types="node" />
import { EventEmitter } from 'node:events';
import type { TraceContext, Attributes, TraceSpan, TraceOptions, TraceSpanStatus } from './types.js';
export declare class Tracer extends EventEmitter {
    #private;
    active: boolean;
    uuidGenerator: () => string;
    get addAttribute(): (span: TraceSpan, name: string, value: unknown) => void;
    get addEvent(): (span: TraceSpan, text: string, attributes?: Attributes | undefined) => void;
    get endSpan(): (span: TraceSpan) => TraceSpan | undefined;
    get setStatus(): (span: TraceSpan, status: TraceSpanStatus, attributes?: Attributes | undefined) => void;
    get startSpan(): (name: string, parent?: TraceSpan | undefined) => TraceSpan;
    get trace(): <T>(name: string, fn: (ctx: TraceContext) => T | Promise<T>, options?: TraceOptions) => T | Promise<T>;
    getActiveSpan(): TraceSpan | undefined;
}
