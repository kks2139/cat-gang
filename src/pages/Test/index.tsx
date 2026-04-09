import { getAnonymousKey } from "@apps-in-toss/web-framework";
import { useState } from "react";

import Button from "@/components/Button";

export default function Test() {
  const [anon, setAnon] = useState<unknown>();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        rowGap: "10px",
        padding: "10px",
      }}
    >
      <h1 style={{ fontWeight: "bold", fontSize: "20px" }}>테스트 페이지</h1>

      <div>
        <Button
          onClick={async () => {
            try {
              const res = await getAnonymousKey();

              setAnon(res);
            } catch (e) {
              const err = e as Error;

              setAnon(`${err.name} : ${err.message}`);
            }
          }}
        >
          {"getAnonymousKey()"}
        </Button>

        <div>{anon as React.ReactNode}</div>
      </div>
    </div>
  );
}
