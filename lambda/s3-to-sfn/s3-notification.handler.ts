import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const QUEUE_URL = process.env.QUEUE_URL!;
const client = new SQSClient({});
const command = new SendMessageCommand({
  MessageBody: 'S3 Updated',
  QueueUrl: QUEUE_URL,
  MessageGroupId: 'default',
});

export const handler = () => client.send(command);
