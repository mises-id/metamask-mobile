/* eslint-disable import/no-namespace */
import * as Sentry from '@sentry/react-native';
import { Dedupe, ExtraErrorData } from '@sentry/integrations';

const METAMASK_ENVIRONMENT = process.env['METAMASK_ENVIRONMENT'] || 'local'; // eslint-disable-line dot-notation
const SENTRY_DSN_PROD =
  'https://486fde2865c84c838fb89a7e8a23022c@o1162849.ingest.sentry.io/6506117'; // metamask-mobile
/**
 * Required instrumentation for Sentry Performance to work with React Navigation
 */
export const routingInstrumentation =
  new Sentry.ReactNavigationV5Instrumentation();

// Setup sentry remote error reporting
export function setupSentry() {
  const environment =
    __DEV__ || !METAMASK_ENVIRONMENT ? 'development' : METAMASK_ENVIRONMENT;
  const dsn = environment === 'production' ? SENTRY_DSN_PROD : null;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    debug: __DEV__,
    environment,
    integrations: [
      new Dedupe(),
      new ExtraErrorData(),
      new Sentry.ReactNativeTracing({
        routingInstrumentation,
      }),
    ],
    tracesSampleRate: 0.2,
  });
}

// eslint-disable-next-line no-empty-function
export function deleteSentryData() {}

export function wrap(app) {
  return Sentry.wrap(app);
}
