import * as t from 'typanion';

export const isManifest = t.isObject({
  resourceProviderId: t.isOptional(t.isString()),
  storageAccountName: t.isOptional(t.isString()),
  subscription: t.isOptional(t.isString()),
  resourceGroup: t.isOptional(t.isString()),
  assets: t.isRecord(t.isString()),
});

export type Manifest = t.InferType<typeof isManifest>;
