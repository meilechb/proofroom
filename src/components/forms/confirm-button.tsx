"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui";

/** Submit button that asks for confirmation first (deletes, revokes). */
export function ConfirmButton({ confirm, children, ...props }: ComponentProps<typeof Button> & { confirm: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
