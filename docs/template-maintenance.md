# Maintaining the Railway template

For maintainers of this repository. `.railway/railway.ts` is the source of truth. The published template must match it, and CI checks that it does.

## Why one step happens in the template editor

Railway makes a template from a live project (`railway templates create`, [CLI docs](https://docs.railway.com/cli/templates)). A template made that way keeps these:

- images, start, pre-deploy and healthcheck commands
- the GitHub source with its root directory
- volume mount paths and the public domain with its port
- every variable whose value contains a `${{...}}` expression or reference

It blanks plain values such as `PORT=8000` and has no variable descriptions. Railway's public API has no call that edits a template's contents. Its template mutations are `templateGenerate`, `templatePublish`, `templateUnpublish`, `templateDelete`, `templateClone`, `templateRevert`, `templateServiceSourceEject`, `templateVolumeUpdate` and the deploy calls (`railway api search template`). So the plain values and descriptions are entered once in the template editor, and `scripts/template.mjs --check` proves they equal the code.

Every `templates create` makes a new template with a new code. Never regenerate the published template, because that would break the deploy button and every existing deployment's update path. Change it in the editor instead.

## Build the template the first time

1. Create an empty project and apply the file to it. This project is the template's source and holds no data:

   ```bash
   npm ci
   railway init --name plane-template-source
   railway config plan
   railway config apply
   ```

2. Generate the draft:

   ```bash
   railway templates create --project plane-template-source --json
   ```

3. Open the `editorUrl` from the output. For each service, fill in every variable from this listing: the value where the editor shows it empty, and the description for every variable.

   ```bash
   node scripts/template.mjs
   ```

4. In the editor, set the template name `Plane Community Edition`, the template icon and each service's icon.
5. Put the template code into the deploy button in `README.md`, then check:

   ```bash
   node scripts/template.mjs --check
   ```

6. Deploy a test project from the draft and run the checks in `docs/test-report.md` before publishing.
7. Publish:

   ```bash
   railway templates publish <template-id> --category Other \
     --description "Plane Community Edition: open-source project management, self-hosted" \
     --readme-file docs/railway-template-description.md
   ```

Delete the source project afterwards. The template keeps its own copy of the configuration.

## Change the template later

1. Change `.railway/railway.ts` (and `proxy/` if needed) in a pull request.
2. After merge, make the same change in the template editor.
3. Run `node scripts/template.mjs --check`. The `Validate Config` workflow runs it on every push and every week, so a template edited in the dashboard without a matching code change fails CI.
4. Update the marketplace text when the overview changed:

   ```bash
   railway templates update <template-id> --category Other \
     --description "Plane Community Edition: open-source project management, self-hosted" \
     --readme-file docs/railway-template-description.md
   ```

A Plane upgrade is such a change: bump `PLANE` in `.railway/railway.ts` and the tag in `proxy/Dockerfile`, take any new pins from the new release's compose file, then change the image tags in the editor.
