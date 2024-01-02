import { Construct } from "constructs";

import { NestedStack, NestedStackProps, RemovalPolicy } from "aws-cdk-lib/core";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";

export interface SchemaStackProps extends NestedStackProps {
  subDomain: string;
}

export class SchemaStack extends NestedStack {
  private readonly _schemaTable: Table;

  constructor(scope: Construct, id: string, props: SchemaStackProps) {
    super(scope, id, {
      ...props,
      description: `[${props.subDomain}] Nested stack provisioning schema infrastructure where sub-site features are defined`,
    });

    this._schemaTable = new Table(this, `SchemaTable`, {
      tableName: `${props.subDomain}SchemaTable`,
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "type",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  get schemaTable(): Table {
    return this._schemaTable;
  }
}
