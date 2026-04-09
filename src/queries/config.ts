import { QueryClient } from "@tanstack/react-query";

export const QUERY_KEY = {
  USERS: "USERS",
  MY_CATS: "MY_CATS",
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
    },
  },
});
