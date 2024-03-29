import path from "path";
import { fileURLToPath } from "url";

import { Construct } from "constructs";

import { Stack, StackProps } from "aws-cdk-lib/core";

import { AssetsStack } from "./stacks/assets.stack.js";
import { ThumbnailStack } from "./stacks/thumbnail.stack.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SiteStackProps extends StackProps {
  hostedZoneId: string;
  parentDomain: string;
  subDomain: string;
  siteDomain: string;
  authDomain: string;
  apiDomain: string;
  enableAuthentication: boolean;
  logLevel?: string;
}

export class SiteStack extends Stack {
  public assetsStack: AssetsStack;
  public thumbnailStack: ThumbnailStack;

  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, {
      ...props,
      stackName: `${props.subDomain}SiteStack`,
      description: `[${props.subDomain}] Root stack for subsite content`,
    });

    this.assetsStack = new AssetsStack(this, `AssetsStack`, {
      parentDomain: props.parentDomain,
      siteDomain: props.siteDomain,
      subDomain: props.subDomain,
      apiDomain: props.apiDomain,
      enableAuthentication: props.enableAuthentication,
      logLevel: props.logLevel,
    });

    this.thumbnailStack = new ThumbnailStack(this, `ThumbnailStack`, {
      subDomain: props.authDomain,
      bucket: this.assetsStack.assetsBucket,
      logLevel: props.logLevel,
    });
  }
}
