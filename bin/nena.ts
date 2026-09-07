#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import {LambdaFunctionStack} from '../infrastructure/lambda-function-stack';
import {ContainerStack} from "../infrastructure/container-stack";
import {DataHostingStack} from "../infrastructure/data-hosting-stack";
import {SftpServerStack} from "../infrastructure/sftp-server-stack";
import {WorkspaceServerStack} from "../infrastructure/workspace-server-stack";

const app = new cdk.App();

new LambdaFunctionStack(app, 'LambdaFunctionStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
});

new ContainerStack(app, 'ContainerStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
});

const variableStarDatasetDataHostingStack = new DataHostingStack(app, 'VariableStarDatasetDataHostingStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    dataName: 'variable-star-dataset',
    readerAccountIds: ['776845170306', '376129880223', '924136568137', '257667174570'],
    tags: {'working-group': '6', 'deployment-environment': 'production'}
});

const freeFloatingPlanetDataDataHostingStack = new DataHostingStack(app, 'FreeFloatingPlanetDataDataHostingStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    dataName: 'free-floating-planet-data',
    readerAccountIds: ['776845170306', '376129880223', '924136568137', '257667174570'],
    tags: {'working-group': '11', 'deployment-environment': 'production'}
});

new WorkspaceServerStack(app, 'WorkspaceServerStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    bucket: freeFloatingPlanetDataDataHostingStack.bucket,
    tags: {'working-group': '11', 'deployment-environment': 'production'},
});

const simulatedMicrolensingEventsDatasetDataHostingStack = new DataHostingStack(app, 'SimulatedMicrolensingEventsDatasetDataHostingStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    dataName: 'simulated-microlensing-events-dataset',
    readerAccountIds: ['776845170306', '376129880223'],
    tags: {'working-group': '7', 'deployment-environment': 'production'}
});

new SftpServerStack(app, 'SftpServerStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION},
    userBucketAccessMapping: [
        {
            username: 'golmschenk',
            buckets: [
                variableStarDatasetDataHostingStack.bucket,
                freeFloatingPlanetDataDataHostingStack.bucket,
                simulatedMicrolensingEventsDatasetDataHostingStack.bucket,
            ]
        },
        {
            username: 'wderocco',
            buckets: [
                freeFloatingPlanetDataDataHostingStack.bucket,
            ]
        },
        {
            username: 'mpenny',
            buckets: [
                simulatedMicrolensingEventsDatasetDataHostingStack.bucket,
            ]
        },
    ],
    tags: {'working-group': '14', 'deployment-environment': 'production'},
});
