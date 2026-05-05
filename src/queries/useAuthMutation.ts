import { useMutation, useQueryClient } from "@tanstack/react-query";

import { initAuth } from "@/utils/db/supabase";

import { QUERY_KEY } from "./config";

export const useAuthMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await initAuth();

        return true;
      } catch {
        return false;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY.USERS] });
    },
    onError: (error) => {
      console.error(error);
    },
  });
};
