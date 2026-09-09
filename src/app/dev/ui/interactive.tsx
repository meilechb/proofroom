"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { Lightbox } from "@/components/ui/lightbox";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { ToastProvider, useToast } from "@/components/ui/toast";

function Inner() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [lb, setLb] = useState<number | null>(null);
  const { toast } = useToast();
  const photos = [1, 2, 3].map((n) => ({ id: String(n), src: `https://placehold.co/1200x800?text=Photo+${n}`, alt: `Sample ${n}` }));
  return (
    <section className="space-y-3">
      <h2 className="font-medium">Interactive</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setDialog(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button>
        <Button variant="secondary" onClick={() => setLb(0)}>Open lightbox</Button>
        <Button variant="secondary" onClick={() => toast("Saved", "success")}>Toast</Button>
        <Menu label="Menu"><MenuItem>Rename</MenuItem><MenuItem>Duplicate</MenuItem><MenuSeparator /><MenuItem danger>Delete</MenuItem></Menu>
      </div>
      <Dialog open={dialog} onClose={() => setDialog(false)} title="A dialog" footer={<><Button variant="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button onClick={() => setDialog(false)}>Confirm</Button></>}>Dialog body.</Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="A drawer">Drawer body.</Drawer>
      <Lightbox photos={photos} index={lb} onClose={() => setLb(null)} onIndexChange={setLb} onFavorite={() => toast("Favorited", "success")} />
    </section>
  );
}

export function DevInteractive() {
  return <ToastProvider><Inner /></ToastProvider>;
}
