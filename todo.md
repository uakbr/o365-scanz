### Critical

- **Reporting API is unauthenticated** — Every reporting and export endpoint is exposed without `requireAuth`, so any caller can pull scanned users, files, and events (including the JSON exports). Protect these routes just like the scanner endpoints.  
```1:84:src/reporting/report.routes.js
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/error-handler');
const reportService = require('./report.service');
const exportService = require('./export.service');
...
router.get('/summary', asyncHandler(async (req, res) => {
  const report = await reportService.generateSummaryReport();
...
router.get('/export/all', asyncHandler(async (req, res) => {
  const exportData = await exportService.exportAllAsJSON();
```

- **Nested OneDrive files are never scanned** — `scanUserFiles` only reads `/drive/root/children`, copies that array, and filters files. The recursive helper is never called, so anything inside subfolders is silently skipped and never persisted. Wire the recursion into the scan so every folder is traversed.  
```87:172:src/scanner/file-scanner.service.js
const files = await this.fetchWithRetry(() =>
  this.fetchAllWithPagination(
    `/users/${userId}/drive/root/children`,
    accessToken
  )
);

// Also fetch files from specific folders recursively
const allFiles = [...files];

// Filter only files (not folders)
const fileItems = allFiles.filter(item => item.file);
...
async scanFolderRecursively(userId, folderId, accessToken) {
  ...
  if (item.folder) {
    const subFiles = await this.scanFolderRecursively(
      userId,
      item.id,
      accessToken
    );
    allFiles = allFiles.concat(subFiles);
  }
```

- **Event date filters are ignored** — Both `scanUserEvents` and `scanUpcomingEvents` build `params` but never pass them to Graph; `fetchAllWithPagination` drops them as well. As a result, `/scan/events`’s `startDate`/`endDate` options and the “upcoming” helper don’t constrain the query at all. Thread the params through `fetchAllWithPagination` (and `get`) so the filters actually reach Graph.  
```89:160:src/scanner/event-scanner.service.js
if (options.startDate && options.endDate) {
  params.$filter = `start/dateTime ge '${options.startDate}' and end/dateTime le '${options.endDate}'`;
}
const events = await this.fetchWithRetry(() =>
  this.fetchAllWithPagination(
    `/users/${userId}/calendar/events`,
    accessToken
  )
);
...
const params = {
  $filter: `start/dateTime ge '${now.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`,
  $orderby: 'start/dateTime'
};
const events = await this.fetchWithRetry(() =>
  this.fetchAllWithPagination(
    `/users/${userId}/calendar/events`,
    accessToken
  )
);
```
```45:67:src/scanner/graph-api.service.js
async fetchAllWithPagination(endpoint, accessToken, allData = []) {
  ...
  const response = await this.get(endpoint, accessToken);
```

- **Missing-resource requests surface as 500s** — When a user is absent, both reporting and export services throw a plain `Error`. The async wrapper converts this to a 500, so clients get “Internal server error” instead of a 404. Throw the shared `NotFoundError` (or similar) so the API reports the correct status.  
```148:183:src/reporting/report.service.js
const user = await userRepository.getUserById(userId);

if (!user) {
  throw new Error('User not found');
}
```
```117:142:src/reporting/export.service.js
const user = await userRepository.getUserById(userId);

if (!user) {
  throw new Error('User not found');
}
```

### Architectural

- **Unsafe string interpolation in SQL limits** — Repository helpers splice `LIMIT`, `OFFSET`, and even `INTERVAL '${parseInt(days)} days'` directly into SQL. Any non-numeric request value (e.g. `limit=abc`) turns into `LIMIT NaN`, provoking a server-side SQL error. Use parameter binding or validate inputs before composing the SQL.  
```69:204:src/storage/*
if (limit) {
  query += ` LIMIT ${parseInt(limit)}`;
}
if (offset) {
  query += ` OFFSET ${parseInt(offset)}`;
}
...
AND start_datetime <= NOW() + INTERVAL '${parseInt(days)} days'
```

- **Attendee upsert can lose data mid-operation** — `upsertEvent` deletes all attendees, then inserts them one by one without a surrounding transaction. Any failure between delete and insert leaves the event with no attendees. Wrap the delete/insert sequence in a single transaction or reuse the existing event transaction support.  
```70:89:src/storage/event.repository.js
await db.query('DELETE FROM event_attendees WHERE event_id = $1', [eventId]);
for (const attendee of attendees) {
  ...
  await db.query(query, values);
}
```

- **Logout depends on a valid Graph token** — `/auth/logout` runs behind `requireAuth`, which in turn refreshes/validates the access token. If the token expired or refresh fails, users are blocked from logging out cleanly. Allow logout to bypass Graph validation so sessions can always be cleared.  
```10:13:src/auth/auth.routes.js
router.post('/refresh', requireAuth, authController.refresh);
router.get('/logout', requireAuth, authController.logout);
```

### Simplification

- **Dead helper after fixing recursion** — Once you wire `scanFolderRecursively` into the main scan, consider removing any leftover unused helpers or comments so future readers aren’t misled by unreachable paths.  
- **Drop unused parameters** — Reporting service methods accept `filters` but never apply them, adding noise for no benefit. Either implement the filters or remove the argument to keep the surface area minimal.