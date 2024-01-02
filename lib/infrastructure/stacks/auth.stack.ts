import { Construct } from "constructs";

import {
  Duration,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
} from "aws-cdk-lib/core";

import {
  AccountRecovery,
  CfnUserPoolGroup,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolDomain,
  UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";

import { Certificate } from "aws-cdk-lib/aws-certificatemanager";

import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";

import { UserPoolDomainTarget } from "aws-cdk-lib/aws-route53-targets";

export interface AuthStackProps extends NestedStackProps {
  parentDomain: string;
  subDomain: string;
  siteDomain: string;
  authDomain: string;
  authHostedZone: HostedZone;
  authCertificate: Certificate;
  geolocationCountryCode?: string;
}

export class AuthStack extends NestedStack {
  private readonly _userPool: UserPool;
  private readonly _userPoolClient: UserPoolClient;
  private readonly _userPoolDomain: UserPoolDomain;
  private readonly _loginURL: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack provisioning the authentication mechanism for the site`,
    });

    this._userPool = new UserPool(this, "UserPool", {
      userPoolName: `${props.subDomain}UserPool`,
      removalPolicy: RemovalPolicy.DESTROY,
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      email: UserPoolEmail.withCognito(),
      signInAliases: {
        email: true,
        username: false,
        phone: false,
        preferredUsername: false,
      },
    });

    new CfnUserPoolGroup(this, "default-group", {
      userPoolId: this._userPool.userPoolId,
      groupName: "default-group",
      description: `The default user group for the user pool`,
    });

    this._userPoolClient = new UserPoolClient(this, "UserPoolClient", {
      userPool: this._userPool,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
          clientCredentials: false,
        },
        callbackUrls: [`https://${props.siteDomain}/callback`],
      },
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      generateSecret: true,
    });

    this._userPoolDomain = new UserPoolDomain(this, "UserPoolDomain", {
      userPool: this._userPool,
      customDomain: {
        domainName: props.authDomain,
        certificate: props.authCertificate,
      },
    });

    new ARecord(this, `UserPoolDomainRecord`, {
      zone: props.authHostedZone,
      recordName: props.authDomain,
      target: RecordTarget.fromAlias(
        new UserPoolDomainTarget(this._userPoolDomain)
      ),
      comment: `Authentication domain alias record for ${props.authDomain}`,
      ttl: Duration.seconds(60),
    });

    this._loginURL = this._userPoolDomain.signInUrl(this._userPoolClient, {
      signInPath: "/login",
      redirectUri: `https://${props.siteDomain}/callback`,
    });
  }

  get userPool(): UserPool {
    return this._userPool;
  }

  get userPoolClient(): UserPoolClient {
    return this._userPoolClient;
  }

  get userPoolDomain(): UserPoolDomain {
    return this._userPoolDomain;
  }

  get loginURL(): string {
    return this._loginURL;
  }
}
