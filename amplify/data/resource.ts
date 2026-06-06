import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  User: a
    .model({
      email: a.string().required(),
      walletAddress: a.string(),
      portfolioValue: a.float(),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
    
  Transaction: a
    .model({
      amount: a.float().required(),
      currency: a.string().required(),
      type: a.enum(['BUY', 'SELL', 'TRANSFER']),
      timestamp: a.datetime().required(),
      userId: a.id(),
    })
    .authorization((allow) => [allow.owner()]),
    
  Portfolio: a
    .model({
      assets: a.json().required(),
      totalValue: a.float().required(),
      lastUpdated: a.datetime().required(),
      userId: a.id(),
    })
    .authorization((allow) => [allow.owner()])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
