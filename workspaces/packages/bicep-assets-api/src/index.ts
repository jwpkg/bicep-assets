import { app } from '@azure/functions';

import { generateSas } from './generate-sas';

app.http('generate-sas', {
  methods: ['POST'],
  authLevel: 'anonymous', // Easy Auth will handle auth externally
  handler: generateSas,
});
