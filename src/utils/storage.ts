import { isToday } from "date-fns";

const STORAGE_KEY = {
  TODAY_DISTANCE: "TODAY_DISTANCE",
};

const SPLIT_TOKEN = "_";

export const getTodayDistance = () => {
  const value = localStorage.getItem(STORAGE_KEY.TODAY_DISTANCE);

  if (!value) {
    return 0;
  }

  const [distance, date] = value.split(SPLIT_TOKEN);

  if (!date || !isToday(date)) {
    return 0;
  }

  return Number(distance);
};

export const storeTodayDistance = (distance: number) => {
  const now = new Date();

  localStorage.setItem(
    STORAGE_KEY.TODAY_DISTANCE,
    distance + SPLIT_TOKEN + now.toISOString(),
  );
};
