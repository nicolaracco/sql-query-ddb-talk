# How to SQL Query DynamoDB

This repository contains a demo project, named LoansFinder, used for my speech "How to SQL Query DynamoDB", presented at the AWS User Group in Milan, in which I illustrate how to mirror DynamoDB data over S3 and query them via Athena with ease.

Slides: https://docs.google.com/presentation/d/1FkYsjbdxg208dtBInAc3JwwJUxeK-ARiKoWjSZMlTBw/edit?usp=sharing

The repository tags help to the reference the different iterations:
- [step.0](https://www.github.com/nicolaracco/sql-query-ddb-talk/tree/step.0): Repository init
- [step.1](https://www.github.com/nicolaracco/sql-query-ddb-talk/tree/step.1): Rest API to work with DynamoDB and data modeling in place
- [step.2](https://www.github.com/nicolaracco/sql-query-ddb-talk/tree/step.2): A DynamoDB stream mirrors DynamoDB data on S3 and new APIs are added to query data via Athena
- [step.3](https://www.github.com/nicolaracco/sql-query-ddb-talk/tree/step.3): Every change to S3 objects sends a message to an SQS queue with a delay of 5 minutes. Messages are consumed by a step function which uses a CTAS query to generate optimized tables in order to reduce the amount and size of objects.
- [step.4](https://www.github.com/nicolaracco/sql-query-ddb-talk/tree/step.4): Loan records are now partitioned by loan type when the CTAS query is ran.
- [step.5](https://www.github.com/nicolaracco/sql-query-ddb-talk/tree/step.5): The CTAS query now creates a denormalized table. Thanks to this, queries don't need joins anymore. Query execution time goes from 2-3 secs to < 1 sec.

## Deploy on your account

This is a CDK project. If you're new to CDK take a look at the [Getting Started](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html).

Requirements:
- node.js > 14

Setup:

```
$ clone git@github.com:nicolaracco/sql-query-ddb-talk.git
$ cd sql-query-ddb-talk
$ npm i
$ npx cdk deploy
# After deploy is completed you can seed some test data
$ npm run seed
```
