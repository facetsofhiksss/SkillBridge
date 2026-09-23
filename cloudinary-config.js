// SkillBridge — Cloudinary settings for profile photo uploads.
//
// Both values below are PUBLIC (safe to ship in client-side code) — Cloudinary's "unsigned
// upload" flow is designed to be called directly from the browser, with no secret key
// involved. NEVER put your Cloudinary API secret in this file or any file the browser loads.
//
// Setup (free tier is enough for this):
//   1. Create an account at https://cloudinary.com
//   2. Your "Cloud name" is shown right on the dashboard — paste it below.
//   3. Go to Settings -> Upload -> Upload presets -> Add upload preset.
//      Set "Signing Mode" to "Unsigned", save, and paste that preset's name below.

export const CLOUDINARY_CLOUD_NAME = "c4w4op3r";
export const CLOUDINARY_UPLOAD_PRESET = "Skillbridge_avatars";
