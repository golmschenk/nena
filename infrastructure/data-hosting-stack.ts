import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as changeCase from 'change-case';
import {Construct} from 'constructs';
import {NenaBaseStack, NenaBaseStackProps} from './nena-base-stack';

interface DataHostingStackProps extends NenaBaseStackProps {
    dataName: string;
    readerAccountIds?: string[];
    fullAccessAccountIds?: string[];
}

export class DataHostingStack extends NenaBaseStack {
    public readonly bucket: s3.Bucket;
    public readonly accessPoint?: s3.CfnAccessPoint;

    constructor(scope: Construct, id: string, props: DataHostingStackProps) {
        super(scope, id, props);

        this.bucket = new s3.Bucket(this, `${changeCase.pascalCase(props.dataName)}Bucket`, {
            bucketName: `${props.dataName}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });

        const accessGroups = [
            {
                accountIds: [...new Set(props.readerAccountIds ?? [])],
                bucketSid: 'DelegateToAccessPoints',
                accessPointSid: 'AllowReaderAccountsRead',
                actions: ['s3:GetObject', 's3:ListBucket'],
            },
            {
                accountIds: [...new Set(props.fullAccessAccountIds ?? [])],
                bucketSid: 'DelegateFullAccessToAccessPoints',
                accessPointSid: 'AllowFullAccessAccountsReadWrite',
                actions: [
                    's3:GetObject*',
                    's3:ListBucket',
                    's3:ListBucketVersions',
                    's3:ListBucketMultipartUploads',
                    's3:ListMultipartUploadParts',
                    's3:PutObject',
                    's3:PutObjectLegalHold',
                    's3:PutObjectRetention',
                    's3:PutObjectTagging',
                    's3:PutObjectVersionTagging',
                    's3:DeleteObject*',
                    's3:AbortMultipartUpload',
                ],
            },
        ].filter(group => group.accountIds.length > 0);

        if (accessGroups.length > 0) {
            for (const group of accessGroups) {
                this.bucket.addToResourcePolicy(new iam.PolicyStatement({
                    sid: group.bucketSid,
                    effect: iam.Effect.ALLOW,
                    principals: group.accountIds.map(accountId => new iam.AccountPrincipal(accountId)),
                    actions: group.actions,
                    resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
                    conditions: {
                        StringEquals: {'s3:DataAccessPointAccount': this.account},
                    },
                }));
            }

            const accessPointName = `rges-pit-${props.dataName}`;
            const accessPointArn = `arn:aws:s3:${this.region}:${this.account}:accesspoint/${accessPointName}`;

            this.accessPoint = new s3.CfnAccessPoint(this, `${changeCase.pascalCase(props.dataName)}AccessPoint`, {
                bucket: this.bucket.bucketName,
                name: accessPointName,
                publicAccessBlockConfiguration: {
                    blockPublicAcls: true,
                    blockPublicPolicy: true,
                    ignorePublicAcls: true,
                    restrictPublicBuckets: true,
                },
                policy: {
                    Version: '2012-10-17',
                    Statement: accessGroups.map(group => ({
                        Sid: group.accessPointSid,
                        Effect: 'Allow',
                        Principal: {AWS: group.accountIds.map(accountId => `arn:aws:iam::${accountId}:root`)},
                        Action: group.actions,
                        Resource: [
                            accessPointArn,
                            `${accessPointArn}/object/*`,
                        ],
                        Condition: {
                            StringEquals: {
                                'aws:RequestedRegion': this.region,
                            },
                        },
                    })),
                },
            });
        }
    }
}
