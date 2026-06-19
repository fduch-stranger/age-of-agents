# Completion Checklist

Before claiming a code change is complete:
- Check `git status --short` and avoid touching unrelated dirty files.
- Run the narrow package test first when possible: `npm run test -w @agent-citadel/server` or `npm run test -w @agent-citadel/client`.
- For cross-package or protocol changes, run `npm test`.
- For build/type safety, run the relevant build command; for release-level confidence run `npm run build`.
- For rendered client/HUD/gameplay changes, start `npm run demo` and verify the app in browser at the Vite URL, checking console errors, blank screens, visible UI state, and at least one relevant interaction.
- For server/watchers/routes changes, prefer tests around parser/state/routes and, when needed, run server demo mode to verify startup.
- Do not rely on build success alone for visual/UI changes.