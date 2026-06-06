import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { auth } from './auth/resource';

export const backend = defineBackend({
  auth,
  data,
});
