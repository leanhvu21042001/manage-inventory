# Serverless - AWS Node.js Typescript Version 2

Serverless Framework template for zero-config TypeScript support.
In this version of the template there is no `aws-sdk` npm package as it is recommended to use modular [version 3 of aws-sdk](https://github.com/aws/aws-sdk-js-v3) instead.

## Features

Thanks to [`serverless-typescript`](https://github.com/prisma-labs/serverless-plugin-typescript) plugin:

- Zero-config: Works out of the box without the need to install any other compiler or plugins
- Supports ES2015 syntax + features (`export`, `import`, `async`, `await`, `Promise`, ...)
- Supports `sls package`, `sls deploy` and `sls deploy function`
- Supports `sls invoke local` + `--watch` mode
- Integrates nicely with [`serverless-offline`](https://github.com/dherault/serverless-offline)

## Prerequisites

- [`serverless-framework`](https://github.com/serverless/serverless)
- [`node.js`](https://nodejs.org)

## Usage

To create new serverless AWS TypeScript project using this template run:

```bash
serverless create \
--template-url https://github.com/ttarnowski/serverless-aws-nodejs-typescript-v2/tree/main \
--path myServiceName
```

where `myServiceName` should be replaced with the name of your choice.

Then change directory to the newly created one:

```
cd myServiceName
```

And run:

```
npm install
```

or:

```
yarn
```

## Deploy
```bash
sls deploy
```
  
## Example
- Create an inventory

  - Endpoint: `https://d7fxawlvth.execute-api.ap-southeast-1.amazonaws.com/inventory`
  - Method: POST
  - Body:
``` json
{
  "name": "Inventory",
  "category": "Category1",
  "price": 11000,
  "current_stock": "21",
  "supplier": {
      "name": "Raymond",
      "description": "Raymod provider"
  }
}
```

- Discount

  - Endpoint: `https://d7fxawlvth.execute-api.ap-southeast-1.amazonaws.com/inventory-discount`
  - Method: PUT
  - Body:
```json
{
  "discount": 1111111111111,
  "category": "Category1"
}
```


- Get One Inventory

  - Endpoint: `https://d7fxawlvth.execute-api.ap-southeast-1.amazonaws.com/inventory/{inventory_id}`
  - Method: GET
  - Example: inventory/3110a50a-d880-442c-ac03-27544a1de558

- Get list Inventories

  - Endpoint: `https://d7fxawlvth.execute-api.ap-southeast-1.amazonaws.com/inventories`
  - Method: GET
  
## Licence

MIT.
