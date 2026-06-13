// server/src/rds-auth.ts
// Helper to generate RDS IAM authentication tokens

import { RDSClient, GenerateAuthorizationTokenCommand } from "@aws-sdk/client-rds";

const rdsClient = new RDSClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function getRDSAuthToken(
  hostname: string,
  port: number,
  username: string
): Promise<string> {
  const command = new GenerateAuthorizationTokenCommand({
    DBHostname: hostname,
    DBPort: port,
    DBUser: username,
  });

  const response = await rdsClient.send(command);
  return response.AuthorizationToken || "";
}

// Usage in index.ts:
// const token = await getRDSAuthToken(
//   'database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com',
//   5432,
//   'postgres'
// );
// Then dynamically update DATABASE_URL if needed
