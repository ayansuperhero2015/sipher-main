# Sipher feature list

## Built

- **Typing indicator** ("Bob is typing…"). Runs on Firebase's Realtime Database, which
  charges by data size instead of per read, so it costs almost nothing.
- **Unread markers**: channels go bold/white when there's something new, a red @ when
  you're mentioned, and dots and badges on the server icons. Also on the Realtime Database.
- **Profile cards**: click any name or picture to see their avatar, @username, "About me",
  role, and Message / Add Friend / Block buttons. Write your "About me" in User Settings.
- **Roles and moderators**: the owner can make people moderators from their profile card.
  Moderators can delete messages, pin, kick regular members, post in read-only channels,
  see private channels, and review reports. Owner names are gold, moderators are green
  with a MOD tag.
- **Polls**: the chart button in the message box, or type `/poll Question | A | B`.
- **Slow mode**: set it per channel in Edit Channel (5 seconds up to 15 minutes).
  Moderators aren't affected.
- **Block users**: from their profile card. They can't DM you or friend-request you,
  and their messages are hidden for you.
- **Search messages**: the magnifying glass at the top of a chat (searches loaded messages).
- **Emoji picker and :shortcodes:**: the smiley in the message box. Typing `:fire:` sends 🔥,
  and typing `:sku` suggests emoji.
- **Notifications and sounds**: the palette button at the bottom-left. A ding for DMs and
  @mentions, plus optional desktop pop-ups when Sipher is in the background.
- **Themes**: Dark, Light and Midnight, plus five accent colours (same palette button).
- **Welcome screen and rules**: written in Server Settings. Members must accept the rules
  before they can chat.
- **Message reports**: the flag on a message. The owner and moderators see them under
  Reports in the server menu.

- **Bad-word filter**: an on/off switch in Server Settings.
- **Who Can Join**: new people need the access code and the main server owner's OK; the owner can ban people from all of Sipher.

## Dropped

- Custom status
- Image and file uploads in chat (would take up too much storage)

## Too costly on the free plan

Voice/video calls and live read receipts.
