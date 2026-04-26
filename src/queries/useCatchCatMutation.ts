import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

interface RequestData {
  catName: string;
  position: { lat: number; lng: number };
}

export const useCatchCatMutation = () => {
  return useMutation<undefined, Error, RequestData>({
    mutationFn: async ({ catName, position }) => {
      const userKey = await UserKey.getInstance().getKey();

      const { error } = await supabase.from("own_cats").insert({
        user_id: userKey || "",
        cat_name: catName,
        position,
      });

      if (error) {
        console.error("에러 발생:", error);
      }
    },
  });
};
