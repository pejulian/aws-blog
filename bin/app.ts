#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { MainStack } from "../lib/main-stack";

const app = new App({});

new MainStack(app, "MainStack", {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT ?? process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION ?? process.env.CDK_DEFAULT_REGION,
  },
  hostedZoneId: app.node.tryGetContext(`hostedZoneId`) ?? ``,
  siteDomain: app.node.tryGetContext(`siteDomain`) ?? ``,
  siteSubDomain: app.node.tryGetContext(`siteSubDomain`) ?? ``,
});
