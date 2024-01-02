#!/usr/bin/env node
import "source-map-support/register";
import { App, Environment, Tags } from "aws-cdk-lib/core";
import { InfrastructureStack } from "../lib/infrastructure/infrastructure.stack.js";
import { SiteStack } from "../lib/site/site.stack.js";

const app = new App({});

const parentDomain = app.node.tryGetContext(`parentDomain`);
const subDomain = app.node.tryGetContext(`subDomain`);
const hostedZoneId = app.node.tryGetContext(`hostedZoneId`);
const enableAuthentication =
  app.node.tryGetContext("enableAuthentication") === "true";

if (!parentDomain || !subDomain || !hostedZoneId) {
  throw new Error(`Invalid/missing context`);
}

const env: Environment = {
  account: process.env.CDK_DEPLOY_ACCOUNT ?? process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION ?? process.env.CDK_DEFAULT_REGION,
};

const siteDomain = `${subDomain}.${parentDomain}`;
const authDomain = `${subDomain}-auth.${parentDomain}`;
const apiDomain = `${subDomain}-api.${parentDomain}`;

const infrastructureStack = new InfrastructureStack(
  app,
  "InfrastructureStack",
  {
    env,
    hostedZoneId,
    parentDomain,
    subDomain,
    siteDomain,
    apiDomain,
    authDomain,
    enableAuthentication,
  }
);

const siteStack = new SiteStack(app, `SiteStack`, {
  env,
  hostedZoneId,
  parentDomain,
  subDomain,
  siteDomain,
  apiDomain,
  authDomain,
  enableAuthentication,
});

siteStack.addDependency(infrastructureStack);

[infrastructureStack, siteStack].forEach((stack) => {
  Tags.of(stack).add(`ParentDomain`, parentDomain);
  Tags.of(stack).add(`SubDomain`, subDomain);
  Tags.of(stack).add(`HostedZoneId`, hostedZoneId);
});
