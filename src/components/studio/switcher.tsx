import { switchStudioAction } from "@/app/(auth)/actions";

export function StudioSwitcher({ memberships, activeId }: { memberships: Array<{ id: string; name: string }>; activeId: string }) {
  return (
    <form action={switchStudioAction} className="lg:mt-3">
      <label className="sr-only" htmlFor="studio-switch">Switch studio</label>
      <select id="studio-switch" name="studioId" defaultValue={activeId} className="select h-9 text-xs" onChange={undefined}>
        {memberships.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <button className="btn-secondary btn-sm mt-1 w-full">Switch</button>
    </form>
  );
}
