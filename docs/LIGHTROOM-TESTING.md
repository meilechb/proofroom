# Lightroom plugin manual test script

The plugin cannot be tested in CI — Lightroom Classic and its Lua runtime are not
available there. Run this checklist on Lightroom Classic (current version) against
a staging studio before every plugin release (plan 18.21).

## Setup

1. In the studio dashboard, go to **Settings → Lightroom** and create a token.
2. Download the plugin from that page (or `GET /api/plugin/download`). Unzip it.
3. In Lightroom: **File → Plug-in Manager → Add** and select
   `proofroom.lrplugin`. It should load without errors.
4. In the **Publish Services** panel, add **Proofroom Galleries**. Paste your
   site URL and token, click **Test connection** — it should say
   "Connected to <studio name>".

## Publish

5. Create a **Published Collection**, edit it, choose an existing client (or
   enter a new client name and email), set type **Proofs**, and enable
   "Make the gallery visible to the client".
6. Drag 3–5 photos in and click **Publish**.
   - Expect a "Gallery created" dialog with a link, an access code, and status.
   - In the dashboard the gallery exists with those photos and the client.
   - Open the client link with the access code; the photos appear.

## Republish and delete

7. Change one photo (crop or edit), publish again.
   - Only the changed photo re-uploads; its position is unchanged.
8. Remove a photo from the collection and publish.
   - The photo disappears from the client gallery; the others are unaffected.

## Feedback

9. As the client, favorite two photos and leave a note on one.
10. In Lightroom, select the published photos and open the **Comments** panel
    (or click the refresh arrows).
    - The favorited photos show a ★ rating and, if enabled, the favorite
      keyword.
    - The client's note appears as a comment on the right photo.

## Dedup and errors

11. Publish the same photo to the same gallery twice — the second time it is
    detected as a duplicate and not re-uploaded.
12. Enter a wrong token and Test connection — the message is plain-language and
    tells you to create a new token. On a failed publish, the warning points at
    the site URL/token and the Lightroom log location.

## Version check

13. If the server's `minPluginVersion` is raised above the plugin's version,
    Test connection asks the user to update.

Record the Lightroom version and OS you tested on in the release notes.
