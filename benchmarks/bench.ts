import { benchmark } from './helpers.js';
import { Tracer } from '../lib/index.js';

const tracer = new Tracer();
const { trace } = tracer;

function fn() {
  // noop
}

await benchmark('trace()', (bench) => {
  bench
    .add('baseline (no tracing)', async () => {
      fn();
    })
    .add('tracing inactive', async () => {
      trace('test', () => fn());
    }, {
      beforeAll() {
        tracer.active = false;
      },
    })
    .add('tracing active', async () => {
      trace('test', () => fn());
    }, {
      beforeAll() {
        tracer.active = true;
      },
    })
})

