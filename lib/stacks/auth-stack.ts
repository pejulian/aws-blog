import { Construct } from "constructs";
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  AccountRecovery,
  CfnUserPoolGroup,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolDomain,
  UserPoolEmail,
} from "aws-cdk-lib/aws-cognito";

export interface AuthStackProps extends StackProps {
  siteDomain: string;
  siteSubDomain: string;
  hostedZoneId: string;
  distributionDomainName: string;
}

export class AuthStack extends Stack {
  private readonly _userPoolId: string;
  private readonly _clientId: string;
  private readonly _loginURL: string;
  private readonly _userPoolDomain: string;
  private readonly _userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.siteSubDomain}] User authentication stack`,
      crossRegionReferences: true,
    });

    const userPool = new UserPool(this, "UserPool", {
      userPoolName: `${props.siteSubDomain}UserPool`,
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      email: UserPoolEmail.withCognito(),
      signInAliases: {
        email: true,
        username: false,
        phone: false,
        preferredUsername: false,
      },
    });

    this._userPoolId = userPool.userPoolId;

    new CfnUserPoolGroup(this, "default-group", {
      userPoolId: userPool.userPoolId,
      groupName: "default-group",
    });

    this._userPoolClient = new UserPoolClient(this, "UserPoolClient", {
      userPool,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
          clientCredentials: false,
        },
        callbackUrls: [`https://${props.distributionDomainName}/callback`],
      },
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      generateSecret: true,
    });

    this._clientId = this._userPoolClient.userPoolClientId;

    const userPoolDomain = new UserPoolDomain(this, "UserPoolDomain", {
      userPool,
      cognitoDomain: {
        domainPrefix: `${props.siteSubDomain}-user-pool`,
      },
    });

    this._userPoolDomain = userPoolDomain.domainName;

    this._loginURL = userPoolDomain.signInUrl(
      this._userPoolClient as UserPoolClient,
      {
        signInPath: "/login",
        redirectUri: `https://${props.distributionDomainName}/callback`,
      }
    );
  }
}
