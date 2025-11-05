import 'dotenv/config';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from '../lib/temporal/activities';

async function run() {
  const address = process.env.TEMPORAL_ADDRESS;
  const namespace = process.env.TEMPORAL_NAMESPACE;
  const apiKey = process.env.TEMPORAL_API_KEY;
  const tlsDisabled = process.env.TEMPORAL_TLS_DISABLED === 'true';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE;

  console.log('Temporal address:', address);
  console.log('Temporal namespace:', namespace);
  console.log('Task queue:', taskQueue);

  if (!address) {
    throw new Error('TEMPORAL_ADDRESS is required');
  }

  if (!namespace) {
    throw new Error('TEMPORAL_NAMESPACE is required');
  }

  if (!taskQueue) {
    throw new Error('TEMPORAL_TASK_QUEUE is required');
  }

  console.log('[Worker] Connecting to Temporal...');
  const connection = await NativeConnection.connect({
    address,
    tls: tlsDisabled ? undefined : {},
    metadata: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
  });
  console.log('[Worker] Connected to Temporal');

  console.log('[Worker] Creating worker...');
  const worker = await Worker.create({
    connection,
    namespace,
    workflowsPath: require.resolve('../lib/temporal/workflows'),
    activities,
    taskQueue,
  });
  console.log('[Worker] Worker created');

  console.log(`[Worker] Started for task queue: ${taskQueue}`);
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});