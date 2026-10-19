# Google Sheet + Apps Script setup

Do this signed in as **mamadou888@gmail.com**. About 10 minutes.
You need the Stripe **restricted key** from the Stripe setup (test mode first).

## 1. Create the sheet and script

1. Go to [sheets.new](https://sheets.new) and name the sheet **Wedding Registry Purchases**.
2. Click **Extensions → Apps Script**. A script editor opens in a new tab.
3. Rename the project (top left) to **Wedding Registry**.
4. In the file list, rename `Code.gs` to `Lib.gs`. Replace its contents with everything in
   `marrying_rehana/apps-script/Lib.js` from this repo.
5. Click **+ → Script** to add a file named `Code`. Paste everything from
   `marrying_rehana/apps-script/Code.gs`.
6. Edit the thank-you emails in `EMAIL_TEMPLATES` at the top of `Code` if you want.
7. Save (⌘S).

## 2. Add the Stripe key

1. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property**.
2. Add `STRIPE_KEY` = your Stripe restricted key (`rk_test_…` now, `rk_live_…` at launch).
   The key only needs **Checkout Sessions: Read**.
3. Add `LAST_CREATED` = `0`.
4. Save.

## 3. Turn it on

1. Back in **Editor**, choose `installTrigger` in the function dropdown and click **Run**.
2. Google asks for permission: **Review permissions → your account → Advanced → Go to Wedding Registry (unsafe) → Allow**.
   ("Unsafe" only means Google hasn't reviewed your personal script.) It asks for access to
   your spreadsheet, to send email as you, and to connect to external services (Stripe).
3. The `Purchases` tab now has a header row, and the sync runs every 5 minutes.

## 4. Publish the status link

1. Click **Deploy → New deployment → ⚙ → Web app**.
2. Description: `registry status`. Execute as: **Me**. Who has access: **Anyone**.
3. Click **Deploy** and copy the **Web app URL** (ends in `/exec`). Send it to Claude, who
   puts it in `marrying_rehana/js/config.js` as `STATUS_URL`.
4. Open the URL in your browser. It should show `{"gifted":{}}`.

## Later

- **Who bought what:** the `Purchases` tab. One row per purchase, with the guest's email,
  name, note, display choice, and whether the thank-you email went out.
- **Changing code:** paste the new code, then **Deploy → Manage deployments → ✏️ →
  Version: New version → Deploy**. The URL stays the same.
- **Going live:** replace `STRIPE_KEY` with the live restricted key, delete the test rows
  (keep the header), and set `LAST_CREATED` back to `0`.
- **Refunding a double purchase:** if two people ever buy the same gift, both rows appear here.
  The site credits the guest who *opened checkout* first (earliest `created_at`), which is usually
  but not always who paid first. Refund the other in the Stripe dashboard (Payments → … → Refund).
- **Thank-you email failed:** rows with `thank_you_sent` = `FALSE` and an email didn't get one
  (e.g. Gmail's daily limit). Send those by hand. Purchases that don't match a registry gift
  (`gift_id` = `unknown`) are recorded but never emailed.
