import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";
import {
  Duration,
  Fn,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
} from "aws-cdk-lib/core";
import {
  AddBehaviorOptions,
  AllowedMethods,
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  GeoRestriction,
  OriginProtocolPolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  OriginSslPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { ApiGateway, CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import {
  Cors,
  RestApi,
  CognitoUserPoolsAuthorizer,
  EndpointType,
  SecurityPolicy,
  IdentitySource,
  ResponseType,
  GatewayResponseOptions,
  CorsOptions,
  LogGroupLogDestination,
  AccessLogFormat,
  MethodLoggingLevel,
  ApiKey,
  UsagePlan,
  ApiKeySourceType,
  Period,
} from "aws-cdk-lib/aws-apigateway";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { LogGroup, LogGroupClass, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ApiStackProps extends NestedStackProps {
  subDomain: string;
  parentDomain: string;
  siteDomain: string;
  apiDomain: string;
  siteDistribution: Distribution;
  apiHostedZone: HostedZone;
  apiCertificate: Certificate;
  userPool: UserPool | undefined;
  geolocationCountryCode?: string;
  enableApiLogs?: boolean;
  enableApiTracing?: boolean;
  apiDistributionPriceClass?: PriceClass;
  apiDistributionGeoRestriction?: string[];
}

export class ApiStack extends NestedStack {
  private _restApi: RestApi;
  private _authorizer: CognitoUserPoolsAuthorizer | undefined;
  private _restApiKey: ApiKey;
  private _usagePlan: UsagePlan;
  private _corsOptions: CorsOptions;
  private _apiDistribution: Distribution;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Site API nested stack`,
    });

    // ==============================================================================
    // CORS OPTIONS
    // ==============================================================================
    this._corsOptions = {
      allowHeaders: [...Cors.DEFAULT_HEADERS],
      allowMethods: Cors.ALL_METHODS,
      allowCredentials: true,
      allowOrigins: [`https://${props.siteDomain}`],
      exposeHeaders: ["Set-Cookie"],
    };

    // ==============================================================================
    // REST API
    // ==============================================================================

    this._restApi = new RestApi(this, `RestApi`, {
      description: `The REST API for ${props.siteDomain}`,
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: RemovalPolicy.DESTROY,
      restApiName: `${props.subDomain}RestApi`,
      endpointTypes: [EndpointType.REGIONAL],
      deploy: true,
      deployOptions: {
        stageName: "prod",
        description: `Default production stage for this api`,
        loggingLevel: MethodLoggingLevel.INFO,
        metricsEnabled: false,
        cachingEnabled: false,
        ...(props.enableApiLogs && {
          accessLogDestination: new LogGroupLogDestination(
            new LogGroup(this, `RestApiLogGroup`, {
              retention: RetentionDays.THREE_DAYS,
              removalPolicy: RemovalPolicy.DESTROY,
              logGroupClass: LogGroupClass.STANDARD,
            })
          ),
          accessLogFormat: AccessLogFormat.jsonWithStandardFields({
            caller: false,
            httpMethod: true,
            ip: true,
            protocol: true,
            requestTime: true,
            resourcePath: true,
            responseLength: true,
            status: true,
            user: true,
          }),
        }),
        tracingEnabled: props.enableApiTracing,
      },
      domainName: {
        certificate: props.apiCertificate,
        domainName: props.apiDomain,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
      defaultCorsPreflightOptions: this._corsOptions,
      apiKeySourceType: ApiKeySourceType.HEADER,
    });

    // https://stackoverflow.com/questions/66142536/cdk-how-to-get-apigateway-key-value-ie-x-api-key-20-chars
    const restApiKeyValue = new Secret(this, `RestApiKeyValue`, {
      secretName: `${props.subDomain}RestApiKeyValueSecret`,
      description: `The secret value for the API key used by the REST API ${this._restApi.domainName}`,
      generateSecretString: {
        generateStringKey: "api_key",
        secretStringTemplate: JSON.stringify({ username: "web_user" }),
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\",
      },
    });

    this._restApiKey = new ApiKey(this, `RestApiKey`, {
      apiKeyName: `${props.subDomain}RestApiKey`,
      description: `The API key for accessing the REST API ${this._restApi.url}`,
      enabled: true,
      value: restApiKeyValue.secretValueFromJson("api_key").unsafeUnwrap(),
    });

    // https://conermurphy.com/blog/build-rest-api-aws-cdk-api-gateway-lambda-dynamodb-api-key-authentication
    this._usagePlan = new UsagePlan(this, `UsagePlan`, {
      name: `${props.subDomain}RestApiUsagePlan`,
      description: `The usage plan for the REST API ${this._restApi.domainName}`,
      apiStages: [
        {
          api: this._restApi,
          stage: this._restApi.deploymentStage,
        },
      ],
      quota: {
        limit: 1000,
        period: Period.DAY,
      },
      throttle: {
        burstLimit: 10,
        rateLimit: 10,
      },
    });

    this._usagePlan.addApiKey(this._restApiKey);

    const corsResponseHeaders: GatewayResponseOptions["responseHeaders"] = {
      "Access-Control-Allow-Origin": `'${this._corsOptions.allowOrigins.join(
        ","
      )}'`,
      "Acesss-Control-Allow-Headers": `'${this._corsOptions.allowHeaders?.join(
        ","
      )}'`,
      "Access-Control-Allow-Methods": `'${this._corsOptions.allowMethods?.join(
        ","
      )}'`,
      "Access-Control-Allow-Credentials": `'${this._corsOptions.allowCredentials}'`,
    };

    this._restApi.addGatewayResponse(
      `${props.subDomain}RestApiDefault4xxResponse`,
      {
        type: ResponseType.DEFAULT_4XX,
        responseHeaders: corsResponseHeaders,
      }
    );

    this._restApi.addGatewayResponse(
      `${props.subDomain}RestApiMissingAuthToken`,
      {
        type: ResponseType.MISSING_AUTHENTICATION_TOKEN,
        responseHeaders: corsResponseHeaders,
      }
    );

    this._restApi.addGatewayResponse(
      `${props.subDomain}RestApiDefault5xxResponse`,
      {
        type: ResponseType.DEFAULT_5XX,
        responseHeaders: corsResponseHeaders,
      }
    );

    // ==============================================================================
    // REST API Authorizer with Cognito User Pool integration
    // ==============================================================================

    if (props.userPool) {
      this._authorizer = new CognitoUserPoolsAuthorizer(
        this,
        `RestApiAuthorizer`,
        {
          cognitoUserPools: [props.userPool],
          authorizerName: `${props.subDomain}RestApiAuthorizer`,
          identitySource: IdentitySource.header("Authorization"),
          resultsCacheTtl: Duration.minutes(1),
        }
      );

      this._authorizer.applyRemovalPolicy(RemovalPolicy.DESTROY);
      this._authorizer._attachToApi(this._restApi);
    }

    // ==============================================================================
    // Associate as behavior to site distribution
    // ==============================================================================

    const apiEndPointUrlWithoutProtocol = Fn.select(
      1,
      Fn.split("://", this._restApi.url)
    );
    const apiEndPointDomainName = Fn.select(
      0,
      Fn.split("/", apiEndPointUrlWithoutProtocol)
    );

    // https://www.reddit.com/r/aws/comments/16foq1w/could_not_get_my_cloudfront_origin_working_api/
    const apiRewriteFunction = new Function(
      this,
      `ApiRewriteCloudfrontFunction`,
      {
        code: FunctionCode.fromFile({
          filePath: path.join(
            __dirname,
            "../../../src/infrastructure/cloudfront-functions/api-rewrite-function.js"
          ),
        }),
        comment: `Cloudfront function to rewrite requests on the "api/*" behavior`,
        functionName: `${props.subDomain}ApiRewriteCloudfrontFunction`,
      }
    );

    // ==============================================================================
    // Distribution setup
    // ==============================================================================

    const apiGatewayOrigin = new HttpOrigin(apiEndPointDomainName, {
      originPath: `/${this._restApi.deploymentStage.stageName}`,
      protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
      originSslProtocols: [OriginSslPolicy.TLS_V1_2],
      customHeaders: {
        "X-Api-Key": restApiKeyValue
          .secretValueFromJson("api_key")
          .unsafeUnwrap(),
      },
    });

    const apiGatewayOriginBehaviorOptions: AddBehaviorOptions = {
      compress: true,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: new CachePolicy(this, "RestApiCachePolicy", {
        headerBehavior: CacheHeaderBehavior.allowList(
          "Authorization",
          "Origin",
          "Referer"
        ),
        queryStringBehavior: CacheQueryStringBehavior.all(),
        cachePolicyName: "ApiGwWithAuthorization",
        cookieBehavior: CacheCookieBehavior.all(),
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true,
        // see https://github.com/aws/aws-cdk/issues/16977 - we need to set the maxTtl to the smallest possible value
        maxTtl: Duration.seconds(1),
        minTtl: Duration.seconds(0),
        defaultTtl: Duration.seconds(0),
      }),
      originRequestPolicy: new OriginRequestPolicy(
        this,
        "RestApiOriginRequestPolicy",
        {
          // this is fun: it looks like no headers will be forwarded, but
          // actually all the headers from the cachePolicy.headerBehavior will be
          // forwarded anyhow. Nice, AWS, very nice....NOT!
          headerBehavior: OriginRequestHeaderBehavior.none(), //allowList('Origin', 'Referer', 'Authorization'),
          queryStringBehavior: OriginRequestQueryStringBehavior.all(),
          cookieBehavior: OriginRequestCookieBehavior.none(),
          originRequestPolicyName: "ApiGwWithAuthorization",
        }
      ),
    };

    this._apiDistribution = new Distribution(this, `ApiDistribution`, {
      priceClass: props.apiDistributionPriceClass ?? PriceClass.PRICE_CLASS_100,
      geoRestriction: props.apiDistributionGeoRestriction
        ? GeoRestriction.allowlist(...props.apiDistributionGeoRestriction)
        : GeoRestriction.allowlist("MY"),
      comment: `Distribution for ${props.apiDomain}`,
      domainNames: [props.apiDomain],
      certificate: props.apiCertificate,
      enableLogging: false,
      defaultBehavior: {
        origin: apiGatewayOrigin,
        ...apiGatewayOriginBehaviorOptions,
      },
    });

    new ARecord(this, `RestApiRecord`, {
      recordName: props.apiDomain,
      zone: props.apiHostedZone,
      comment: `Alias record for routing traffic to ${props.apiDomain}`,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(this._apiDistribution)
      ),
      // target: RecordTarget.fromAlias(new ApiGateway(this._restApi)),
      ttl: Duration.seconds(60),
    });

    props.siteDistribution.addBehavior("api/*", apiGatewayOrigin, {
      ...apiGatewayOriginBehaviorOptions,
      functionAssociations: [
        {
          function: apiRewriteFunction,
          eventType: FunctionEventType.VIEWER_REQUEST,
        },
      ],
    });

    // ==============================================================================
    // Outputs
    // ==============================================================================

    this.exportValue(this._restApiKey.keyId, {
      name: `${props.subDomain}RestApiKeyId`,
    });
  }

  get apiDistribution(): Distribution {
    return this._apiDistribution;
  }

  get restApi(): RestApi {
    return this._restApi;
  }

  get authorizer(): CognitoUserPoolsAuthorizer | undefined {
    return this._authorizer;
  }

  get corsOptions(): CorsOptions {
    return this._corsOptions;
  }

  get restApiKey(): ApiKey {
    return this._restApiKey;
  }

  get usagePlan(): UsagePlan {
    return this._usagePlan;
  }
}
