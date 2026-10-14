# Vietnamese and English

Vietnamese is the default. The VI / EN buttons in the header and dialogs switch the interface immediately. The browser remembers the choice using `lending-language`; changes also propagate to other tabs. HTML language, page title, description, dates and amount formatting follow the selection. Amounts remain in VND; no currency conversion is performed.

Translations live in `web/src/locales/en.json`, keyed by the Vietnamese UI text. `web/src/i18n.js` manages language state. Components explicitly translate display labels; API payloads and database values remain unchanged. Keep explicit `value` attributes on translated select options. Do not translate user-entered titles, descriptions, names, document names or progress notes. Existing sample records and sample form values remain in their original language.

Validation: `npm run build`, `npm test`, `npm run test:e2e`. Browser tests allow two minutes for the full workflow and 15 seconds for assertions on constrained cloud machines. The language browser tests cover persistence, document metadata, mobile layout, canonical select values and preserving a draft while switching languages.

## Update the existing Spaceship demo

The language release changes only the frontend. No database migration or new npm dependency is required.

Build the upload archive with `bash deploy/package-language-update.sh` (requires the `zip` command).

1. In cPanel File Manager, open the existing application root `lendinghub`.
2. Download a backup of its current `dist` directory before replacing files.
3. Upload `lendinghub-language-update.zip` into `lendinghub` and Extract there, allowing replacement. The ZIP contains `dist/index.html` and `dist/assets/`. The result must be `lendinghub/dist/index.html`, not `lendinghub/dist/dist/index.html`.
4. Keep `.data`, `.env`, `server`, `app.cjs` and the application's Node.js settings intact. This ZIP contains none of those files. Keep existing hashed asset files so already-open browser tabs still work.
5. Reload `https://shenlong.space` with Ctrl+Shift+R (or Cmd+Shift+R on Mac). A Node.js restart is normally unnecessary for static assets; restart from cPanel if the hosting layer still serves the old page.
6. Verify that EN changes Overview, navigation, filters and dialog labels; reload and confirm English stays selected. Check VI restores Vietnamese. Try a sample application and check the layout on a phone.

To roll back, restore the backed-up `dist/index.html` and its associated assets. Database contents are unaffected by this frontend release. Remove the uploaded archive from the hosting after extraction.
