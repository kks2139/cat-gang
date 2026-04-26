import type { PostgrestError } from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

import { QUERY_KEY } from "./config";

interface RequestData {
  catName: string;
  crying: string;
}

export const useAddUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<PostgrestError | undefined, Error, RequestData>({
    mutationFn: async ({ catName, crying }) => {
      const userKey = await UserKey.getInstance().getKey();

      const { error } = await supabase.from("users").insert({
        user_id: userKey || "",
        name: catName,
        crying,
      });

      if (error) {
        return error;
      }
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY.USERS] });
    },
  });
};
