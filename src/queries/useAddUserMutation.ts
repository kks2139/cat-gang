import type { PostgrestError } from "@supabase/supabase-js";
import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";

interface RequestData {
  id: number;
  catName: string;
  crying: string;
}

export const useAddUserMutation = () => {
  return useMutation<PostgrestError | undefined, Error, RequestData>({
    mutationFn: async ({ id, catName, crying }) => {
      const { error } = await supabase.from("users").insert({
        id,
        name: catName,
        crying,
      });

      if (error) {
        return error;
      }
    },
  });
};
