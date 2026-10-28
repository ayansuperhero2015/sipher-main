# Sipher Chat

A Discord-style chat app built on Firebase (Auth + Cloud Firestore), with no build step.
The entry point is **`index.svg`**: an SVG document that hosts the UI in a
`<foreignObject>` and loads its stylesheet and ES modules from separate files.

## Features

- Email/password sign-in with email verification and password reset; the links
  in those emails open Sipher itself (see "Email links" below)
- New accounts join the main Sipher server automatically (`js/config.js`)
- Direct messages: click anyone in a member list; unread dots and a badge on the
  ⚡ Direct Messages button
- Servers: create, rename, delete, leave, with uploadable server icons
- Profile pictures (avatars) and display names; drag and zoom to choose which part
  of an uploaded image shows
- Invite links/codes to join a server, with reset
- Text channels: create, rename, delete (server owner)
- Real-time messages with grouping, day dividers, edit/delete, and light markdown
  (`**bold**`, `*italic*`, `` `code` ``, ` ```code blocks``` `, links)
- GIFs and media: GIPHY, Tenor and Imgur links, plus direct `.gif`/image/video
  URLs, play inline (no API key needed). A message that is only a GIF link shows
  just the GIF.
- GIF search button in the message box (GIPHY, cached to fit the free key's limits)
- Member list with online/offline presence; owners can kick members
- Unsent drafts kept per channel; press ↑ in an empty composer to edit your last message
- Responsive layout with a slide-out sidebar on phones

## Layout

```
index.svg            entry point: SVG shell + <foreignObject> root
css/styles.css       theme and layout (linked via <?xml-stylesheet?>)
js/shim.js           makes the SVG document HTML-friendly for the Firebase SDK
js/firebase.js       Firebase config and initialization (app, auth, firestore, analytics)
js/api.js            all Firestore reads/writes and the data model
js/config.js         the main server's invite (auto-join for new accounts)
js/embeds.js         turns GIF/image/video links into inline embeds
js/gifs.js           GIPHY search with shared caching and an hourly budget
js/image.js          crops/shrinks uploaded icons and avatars to small data URLs
js/dom.js            DOM helpers (XHTML-namespaced element builder, icons, avatars, toasts)
js/main.js           app state, routing, listeners and actions
js/ui/*.js           auth screen, email-link pages, server rail, sidebar (channels/DMs),
                     chat pane, member list, GIF picker, cropper, modals
firestore.rules      security rules
firebase.json        Firebase Hosting + Firestore config
```

## Firebase setup

In the [Firebase console](https://console.firebase.google.com/project/sipher-e3cfb):

1. **Authentication → Sign-in method:** enable **Email/Password**.
2. **Authentication → Settings → Authorized domains:** add any domain you serve from
   (`localhost` is there by default).
3. **Firestore Database:** create a database if you haven't yet.
4. Deploy the security rules (the app relies on them for access control):

   ```sh
   npm install -g firebase-tools
   firebase login
   cd sipher-chat
   firebase deploy --only firestore:rules
   ```

## Email links

Verification and password-reset emails link to Firebase's own page by default.
To make them open Sipher instead, in the Firebase console go to
**Authentication → Templates**, click the pencil on any template, choose
**Customize action URL**, and enter the app's address, e.g.

```
https://cdn.jsdelivr.net/gh/ayansuperhero2015/sipher-main@main/sipher-chat/index.svg
```

The setting applies to every template. `js/ui/action.js` handles the links.

## GIF search

The GIF button searches GIPHY. The API key is not in the code: the owner of the
main server pastes it into **Server Settings → GIPHY API key**, and it's stored in
Firestore (`config/giphy`). The free key allows
**100 calls an hour shared by every visitor**, so the app treats a call as the
last resort:

- Results are shared through Firestore (`gifCache`): once anyone searches a word,
  everyone gets it from the cache for 7 days (trending: 2 hours). Searches are
  normalized, so "Cat " and "cat" are the same entry.
- Each call fetches 50 GIFs, so there's never a second page to load.
- Searching waits for an 800 ms pause in typing (or Enter); one-letter queries
  show trending instead.
- A shared counter (`gifQuota`) stops at 90 calls an hour, and each browser may
  use at most 15 of them. Past that, older cached results are shown, or a
  "try again in a bit" message.

To change the limits, edit the constants at the top of `js/gifs.js`.

## Running locally

The files are ES modules, so serve them over HTTP rather than opening from `file://`:

```sh
cd sipher-chat
npx serve .          # or: python3 -m http.server 8080
```

Then open `http://localhost:3000/index.svg` (or `:8080/index.svg`).

### Against the local emulators

To develop without touching the real project, run the Auth and Firestore emulators
(they load `firestore.rules` automatically) and add `?emulator` to the URL:

```sh
cd sipher-chat
firebase emulators:start      # serves the app on :5000 too
```

Open `http://localhost:5000/index.svg?emulator`.

## Deploying

```sh
cd sipher-chat
firebase deploy      # hosting + rules
```

`firebase.json` redirects `/` to `/index.svg`.

## Notes

- The Firebase web config in `js/firebase.js` is public by design; Firestore rules enforce access.
- Server icons and avatars are resized to 128×128 in the browser and stored inline in
  Firestore, so no Firebase Storage bucket (or paid plan) is needed.
- Deleting a server removes its channels, members and invite. Messages are left orphaned but
  unreadable; purge them with `firebase firestore:delete --recursive servers/<id>` if needed.
- Because the page is an SVG (XML) document, UI code must build elements with
  `createElementNS` (see `js/dom.js`) and avoid `innerHTML`.
