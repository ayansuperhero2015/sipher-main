// App-wide settings.

// Every new account is added to the server behind this invite (the main
// Sipher server). Its owner can also set the GIPHY key in Server Settings.
// If the invite is ever reset, put the new code here and in firestore.rules.
export const DEFAULT_INVITE = "N4bVJRRD";

// The only accounts allowed to send photos (AyanDaBeast). firestore.rules
// enforces the same list in canSendPhotos(); keep the two in sync.
export const PHOTO_SENDERS = ["48wvx7C8NCfmCzBHlYPuu25Dbq03"];
