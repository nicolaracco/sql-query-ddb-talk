import { DynamoDBStreamEvent } from 'aws-lambda';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const BUCKET_NAME = process.env.BUCKET_NAME!;
const OBJECT_PREFIX = process.env.OBJECT_PREFIX!;

const s3 = new S3Client({});

function serializeDocument(image: Record<string, any>): string {
  const sanitized = Object.entries(image).reduce<Record<string, any>>((memo, [key, value]) => {
    if (!['PK', 'SK', '_et', 'GSI1PK', 'GSI1SK'].includes(key)) {
      memo[key] = value;
    }
    return memo;
  }, {});
  return JSON.stringify(sanitized);
}

async function deleteObjectForDocument(id: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${OBJECT_PREFIX}${id}.json`,
    }),
  );
}

async function createObjectForDocument(id: string, record: Record<string, any>): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${OBJECT_PREFIX}${id}.json`,
      Body: serializeDocument(record),
    }),
  );
}

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  for (const record of event.Records) {
    const id = record.dynamodb!.Keys!.SK.S!.split('#').join('/');
    if (record.eventName === 'REMOVE') {
      console.log(`Deleting ${id}`);
      await deleteObjectForDocument(id);
    } else {
      console.log(`Putting ${id}`);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Property '$unknown' is missing in type.
      await createObjectForDocument(id, unmarshall(record.dynamodb!.NewImage!));
    }
  }
}
