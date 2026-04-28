import { getOperationalEnvironment } from "@apps-in-toss/web-framework";

export const isDev = import.meta.env.MODE === "development";

export const operEnv = (() => {
  try {
    return getOperationalEnvironment();
  } catch {
    return null;
  }
})();
