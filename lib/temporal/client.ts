import { Connection, WorkflowClient, type Metadata } from '@temporalio/client';
import { env } from '../env';

let temporalConnection: Connection | null = null;
let temporalClient: WorkflowClient | null = null;

function createMetadata(apiKey?: string): Metadata | undefined {
  if (!apiKey) {
    return undefined;
  }

  return {
    authorization: `Bearer ${apiKey}`,
  };
}

export async function getTemporalConnection() {
  if (temporalConnection) {
    return temporalConnection;
  }

  console.log('[Temporal] Connecting to:', env.temporal.address, 'namespace:', env.temporal.namespace);

  temporalConnection = await Connection.connect({
    address: env.temporal.address,
    tls: env.temporal.tlsDisabled ? undefined : {},
    metadata: createMetadata(env.temporal.apiKey),
  });

  return temporalConnection;
}

export async function getTemporalClient() {
  if (temporalClient) {
    return temporalClient;
  }

  const connection = await getTemporalConnection();

  temporalClient = new WorkflowClient({ connection, namespace: env.temporal.namespace });

  return temporalClient;
}
