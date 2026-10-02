# DSA Tracker v4

## New features
- Paste a problem URL and auto-fetch its title.
- LeetCode metadata: title, difficulty and topic tags.
- Popular topic and pattern dropdowns with custom values.
- Every solved problem automatically enters the revision system.
- Manual "Add to Revision" is still available.
- Pattern filter for your stored problems.
- Dedicated revision history/schedule table.

## Setup
1. Keep your existing Supabase URL and Publishable Key in `js/supabase.js`.
2. Run `SUPABASE_V4.sql` in Supabase SQL Editor.
3. Deploy the Edge Function in `supabase/functions/fetch-problem` as `fetch-problem`.
4. Serve the folder with Live Server.

Supabase CLI deployment command from the project root:

`supabase functions deploy fetch-problem`

The Edge Function is used because browser JavaScript cannot reliably fetch LeetCode/other problem pages directly due to CORS restrictions.
