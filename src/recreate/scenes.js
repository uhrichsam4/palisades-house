// Re-create scenes: short videos (TikToks etc.) matched to a spot in the house. When a player walks
// into a scene's `area` a "Re-create" button appears; it seats them in one of the video's people
// positions, and Start plays the video's AUDIO for everyone taking part (synced over multiplayer).
//
// ---- HOW TO ADD A VIDEO ----------------------------------------------------------------------
// 1. Extract the audio (small mono AAC is plenty):
//      ffmpeg -i video.mp4 -vn -ac 1 -c:a aac -b:a 64k assets/recreate/<id>.m4a
//    and read its length:  ffprobe -v error -show_entries format=duration -of csv=p=0 assets/recreate/<id>.m4a
// 2. Append one entry to SCENES below. Done — no other code changes.
//
// ---- FORMAT ------------------------------------------------------------------------------------
// {
//   id:       'kebab-case-id' (unique; also the audio file name),
//   title:    shown on the button: "🎬 Re-create: <title> (R)",
//   level:    0 = ground floor, 1 = upper floor,
//   area:     [x0, z0, x1, z1] world-metre rectangle where the button shows (see src/plan.js ROOMS[..].rect),
//   seats:    up to 4 people positions, in the order players get them:
//             { pos: [x, y, z], yaw, pose }
//               pose 'sit'  : pos = point on the cushion/seat surface under the pelvis (y = seat top)
//               pose 'lie'  : pos = point on the surface under the pelvis; head points AWAY from yaw
//               pose 'stand'/'lean' : pos = floor point under the feet
//               yaw  = direction the person faces, radians: 0 = -z, PI/2 = -x, PI = +z, -PI/2 = +x
//   audio:    'assets/recreate/<id>.m4a',
//   duration: seconds (length of the audio),
//   center:   optional [x, y, z] where bystanders hear the sound from (default: mean of the seats, y + 1)
// }
// Coordinates: +x = north-east (garage end), +z = south-east (pool side), ground floor y = 0, upper 3.35.
//
// Video spots (src/videos/spots.js) are appended automatically (src/videos/geom.js spotScene): audio = the
// clip's own mp4 (WebAudio decodes its AAC track), `video` = the clip (src/videos.js shows it muted, synced,
// while the scene plays), `snap` = generated standing seats get dropped onto the ground at first use.
import { SPOTS } from '../videos/spots.js';
import { spotScene } from '../videos/geom.js';

export const SCENES = [
  {
    // DEMO (placeholder audio: soft pad + a tick every second, higher tick every 5 s — handy to hear sync).
    // Family-room sofa: straight 3.30 m sofa, back at x = 6.80, front edge x = 5.78, seat top y ≈ 0.44,
    // seat cushions z 15.88..18.70; people face the TV wall (-x).
    id: 'family-sofa',
    title: 'Family room sofa',
    level: 0,
    area: [2.65, 13.60, 8.30, 20.02],
    seats: [
      { pos: [6.27, 0.44, 16.24], yaw: Math.PI / 2, pose: 'sit' },
      { pos: [6.27, 0.44, 16.94], yaw: Math.PI / 2, pose: 'sit' },
      { pos: [6.27, 0.44, 17.64], yaw: Math.PI / 2, pose: 'sit' },
      { pos: [6.27, 0.44, 18.34], yaw: Math.PI / 2, pose: 'sit' },
    ],
    audio: 'assets/recreate/family-sofa.m4a',
    duration: 20,
  },
  ...SPOTS.map(spotScene),
];
