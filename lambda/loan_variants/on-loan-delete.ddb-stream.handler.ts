import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

const TableName = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function deleteLoanVariants(loanFullId: string): Promise<void> {
  const records = await client.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: `PK = :PK`,
      ExpressionAttributeValues: {
        ':PK': loanFullId,
      },
      Select: 'SPECIFIC_ATTRIBUTES',
      ProjectionExpression: 'SK',
    }),
  );
  if (records.Items && records.Items.length > 0) {
    console.log(`Deleting ${records.Items.length} variants for loan ${loanFullId}`);
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [TableName]: records.Items!.map((item) => ({
            DeleteRequest: {
              Key: {
                PK: loanFullId,
                SK: item.SK,
              },
            },
          })),
        },
      }),
    );
  } else {
    console.log(`No variants to delete found for loan ${loanFullId}`);
  }
}

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  for (const record of event.Records) {
    const loanFullId = record.dynamodb!.OldImage!.SK!.S!;
    await deleteLoanVariants(loanFullId);
  }
}
