"use client";

import { useActionState, useState } from "react";
import type { StoreCollection } from "@/lib/types";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { ImagePicker, type PickerAsset } from "../../website/image-picker";
import { saveCollectionAction } from "../actions";

export function CollectionDialog({ collection, trigger, assets }: { collection?: StoreCollection; trigger: "add" | "edit"; assets: PickerAsset[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveCollectionAction, initialActionState);
  const [coverId, setCoverId] = useState<string | null>(collection?.cover_asset_id ?? null);

  return (
    <>
      {trigger === "add" ? (
        <Button onClick={() => setOpen(true)}>New collection</Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={collection ? "Edit collection" : "New collection"}>
        <form action={action} className="space-y-4" noValidate>
          {collection ? <input type="hidden" name="id" value={collection.id} /> : null}
          <input type="hidden" name="coverAssetId" value={coverId ?? ""} />
          <FormMessage state={state} />
          <Field label="Title" htmlFor="c-title" error={state.fields?.title}><Input id="c-title" name="title" required defaultValue={collection?.title} /></Field>
          <Field label="Description" htmlFor="c-desc"><Textarea id="c-desc" name="description" rows={2} defaultValue={collection?.description ?? ""} /></Field>
          <Field label="Visibility" htmlFor="c-vis" hint="Hidden collections are reachable only by direct link.">
            <Select id="c-vis" name="visibility" defaultValue={collection?.visibility ?? "public"}>
              <option value="public">Public — listed in the shop</option>
              <option value="unlisted">Unlisted — link only</option>
              <option value="hidden">Hidden</option>
            </Select>
          </Field>
          <ImagePicker label="Cover image" value={coverId} assets={assets} onChange={setCoverId} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton>{collection ? "Save" : "Create"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
