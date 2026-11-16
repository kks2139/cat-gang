import { QueryClient } from "@tanstack/react-query";

export const QUERY_KEY = {
  USERS: "USERS",
  MY_CATS: "MY_CATS",
  ITEMS: "ITEMS",
  RANKINGS: "RANKINGS",
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
    },
  },
});
