import { defineAuth } from '@aws-amplify/auth';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  signInAlias: ['email'],
  userAttributes: {
    email: {
      required: true,
    },
  },
});
