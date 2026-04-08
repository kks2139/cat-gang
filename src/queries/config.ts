import { QueryClient } from "@tanstack/react-query";

export const QUERY_KEY = {
  USERS: "USERS",
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
    },
  },
});
