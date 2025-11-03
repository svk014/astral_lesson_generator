import { Connection, WorkflowClient, type Metadata } from '@temporalio/client';

let temporalClient: WorkflowClient | null = null;

function createMetadata(apiKey?: string): Metadata | undefined {
  if (!apiKey) {
    return undefined;
  }

  return {
    authorization: `Bearer ${apiKey}`,
  };
}

export async function getTemporalClient() {
  if (temporalClient) {
    return temporalClient;
  }

  const address = process.env.TEMPORAL_ADDRESS;
  const namespace = process.env.TEMPORAL_NAMESPACE;
  const apiKey = process.env.TEMPORAL_API_KEY;
  const tlsDisabled = process.env.TEMPORAL_TLS_DISABLED === 'true';

  if (!address) {
    throw new Error('TEMPORAL_ADDRESS is required');
  }

  if (!namespace) {
    throw new Error('TEMPORAL_NAMESPACE is required');
  }

  const connection = await Connection.connect({
    address,
    tls: tlsDisabled ? undefined : {},
    metadata: createMetadata(apiKey),
  });

  temporalClient = new WorkflowClient({ connection, namespace });

  return temporalClient;
}
