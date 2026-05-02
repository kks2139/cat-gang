import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ItemType } from "@/components/Stage/Inventory";
import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

import { QUERY_KEY } from "./config";

interface RequestData {
  itemType: ItemType;
  count: number;
}

export const useItemMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<undefined, Error, RequestData>({
    mutationFn: async ({ itemType, count }) => {
      const userKey = await UserKey.getInstance().getKey();

      const { error } = await supabase
        .from("items")
        .update({
          [itemType]: count,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("user_id", userKey || "");

      if (error) {
        console.error(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY.ITEMS] });
    },
    retry: 1,
  });
};
