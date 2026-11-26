// App-wide settings.

// Every new account is added to the server behind this invite (the main
// Sipher server). Its owner can also set the GIPHY key in Server Settings.
// Whoever owns the server behind this invite is the admin of all of Sipher,
// so firestore.rules (isMainInvite) never lets this invite be reset or
// deleted. Keep the code here and there the same.
export const DEFAULT_INVITE = "N4bVJRRD";

// The only accounts allowed to send photos (AyanDaBeast). firestore.rules
// enforces the same list in canSendPhotos(); keep the two in sync.
export const PHOTO_SENDERS = ["48wvx7C8NCfmCzBHlYPuu25Dbq03"];
