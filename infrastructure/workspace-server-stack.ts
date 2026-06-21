import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {Construct} from 'constructs';
import {NenaBaseStack, NenaBaseStackProps} from './nena-base-stack';
import {userToPublicSshKeyRecord} from './ssh-users';

interface WorkspaceServerStackProps extends NenaBaseStackProps {
    bucket: s3.IBucket;
}

export class WorkspaceServerStack extends NenaBaseStack {
    constructor(scope: Construct, id: string, props: WorkspaceServerStackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'WorkspaceServerVpc', {
            maxAzs: 1,
            natGateways: 0,
            subnetConfiguration: [
                {
                    name: 'public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
            ],
        });

        const securityGroup = new ec2.SecurityGroup(this, 'WorkspaceServerSecurityGroup', {
            vpc,
            allowAllOutbound: true,
        });

        securityGroup.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(22),
            'Allow SSH inbound',
        );

        const userData = ec2.UserData.forLinux();

        userData.addCommands(
            `sed -i '/^#\\?PasswordAuthentication/d' /etc/ssh/sshd_config`,
            `echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config`,
            `sed -i '/^#\\?KbdInteractiveAuthentication/d' /etc/ssh/sshd_config`,
            `echo 'KbdInteractiveAuthentication no' >> /etc/ssh/sshd_config`,
            `systemctl restart sshd`,
        );

        for (const username of ['golmschenk', 'wderocco']) {
            const publicKey = userToPublicSshKeyRecord[username];
            userData.addCommands(
                `useradd -m -s /bin/bash ${username}`,
                `mkdir -p /home/${username}/.ssh`,
                `echo '${publicKey}' > /home/${username}/.ssh/authorized_keys`,
                `chmod 700 /home/${username}/.ssh`,
                `chmod 600 /home/${username}/.ssh/authorized_keys`,
                `chown -R ${username}:${username} /home/${username}/.ssh`,
            );
        }

        const instance = new ec2.Instance(this, 'WorkspaceServerInstance', {
            vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
            machineImage: ec2.MachineImage.latestAmazonLinux2023(),
            securityGroup,
            userData,
            vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
            associatePublicIpAddress: true,
        });

        props.bucket.grantReadWrite(instance.role);
    }
}
