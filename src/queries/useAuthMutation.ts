import { useMutation } from "@tanstack/react-query";

import { initAuth } from "@/utils/db/supabase";

export const useAuthMutation = () => {
  return useMutation({
    mutationFn: async () => {
      try {
        await initAuth();

        return true;
      } catch {
        return false;
      }
    },
    onError: (error) => {
      console.error(error);
    },
  });
};
