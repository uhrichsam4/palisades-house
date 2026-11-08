// Video spots: phone videos shot at this house, each placed where it was filmed.
// cam  = the phone camera that shot it, matched against the 3D house (world metres, see src/plan.js):
//        pos [x,y,z], look [x,y,z] (a point it looks at), fov = VERTICAL field of view in degrees for the 9:16
//        portrait frame, roll = degrees (positive = clockwise tilt of the phone), at time t (seconds into the clip).
// people = where the people in the video are (feet on the floor, world metres), facing yaw (radians, 0 = -z,
//        same as the player), pose 'stand' | 'sit' | 'lean' | 'lie'  -> Re-create seats.
// matched = false while the camera is still a rough guess.
// Clips are trimmed (no TikTok end card); level 0 = ground floor / outside, 1 = upstairs.
export const SPOTS = [
  { id: 'v01', title: 'Front planter standoff', src: 'assets/videos/v01.mp4', poster: 'assets/videos/v01.jpg', level: 0, duration: 7.75,
    cam: { pos: [10.2, 1.5, 3.8], look: [7.6, -1.0, -5.9], fov: 70.0, roll: 0.0, t: 6.59 }, people: [{ pos: [9.28, 0.46, 2.27], yaw: -2.4, pose: "sit" }, { pos: [10.02, 0.0, 1.96], yaw: -3.04, pose: "stand" }], matched: true },
  { id: 'v02', title: "5'11 vs 6'0", src: 'assets/videos/v02.mp4', poster: 'assets/videos/v02.jpg', level: 0, duration: 9.35,
    cam: { pos: [15.0, 1.2, 26.5], look: [15.0, 4.0, 40.0], fov: 72.0, roll: -5.0, t: 4.67 }, people: [{ pos: [15.27, -0.12, 28.35], yaw: 0.0, pose: "stand" }, { pos: [14.48, -0.12, 28.73], yaw: 0.0, pose: "stand" }], matched: true },
  { id: 'v03', title: 'TV wall shirt swap', src: 'assets/videos/v03.mp4', poster: 'assets/videos/v03.jpg', level: 0, duration: 11.15,
    cam: { pos: [5.3, 1.5, 14.4], look: [3.2, 1.5, 18.8], fov: 68.0, roll: 0.0, t: 0.4 }, people: [{ pos: [4.79, 0.0, 16.72], yaw: 0.83, pose: "stand" }, { pos: [3.83, 0.0, 16.36], yaw: -2.02, pose: "stand" }], matched: true },
  { id: 'v04', title: 'Junk food in the nook', src: 'assets/videos/v04.mp4', poster: 'assets/videos/v04.jpg', level: 0, duration: 10.25,
    cam: { pos: [19.22, 1.07, 20.12], look: [19.48, 1.49, 23.11], fov: 75.0, roll: 0.0, t: 5.12 }, people: [{ pos: [19.35, 0.46, 21.0], yaw: 0.0, pose: "sit" }, { pos: [18.7, 0.46, 21.0], yaw: 0.0, pose: "sit" }], matched: true },
  { id: 'v05', title: 'So generous (tennis)', src: 'assets/videos/v05.mp4', poster: 'assets/videos/v05.jpg', level: 0, duration: 9.15,
    cam: { pos: [36.85, 1.35, 29.5], look: [33.13, 1.124, 20.22], fov: 69.2, roll: -0.9, t: 7.78 }, people: [{ pos: [35.4, -0.276, 25.7], yaw: 0.35, pose: "stand" }], matched: true },
  { id: 'v06', title: 'Who ruins the 6 man', src: 'assets/videos/v06.mp4', poster: 'assets/videos/v06.jpg', level: 0, duration: 9.85,
    cam: { pos: [13.0, 1.4, 27.9], look: [13.0, 3.9, 40.0], fov: 72.0, roll: -4.0, t: 4.92 }, people: [{ pos: [13.0, -0.12, 29.0], yaw: 0.0, pose: "stand" }], matched: true },
  { id: 'v07', title: 'Shirt debate at the spa', src: 'assets/videos/v07.mp4', poster: 'assets/videos/v07.jpg', level: 0, duration: 10.05,
    cam: { pos: [3.4, 1.693, 25.257], look: [11.4, -0.09, 30.99], fov: 61.35, roll: 0.24, t: 5.02 }, people: [{ pos: [6.43, -0.1, 26.72], yaw: 2.97, pose: "stand" }, { pos: [6.19, 0.35, 28.15], yaw: -0.17, pose: "stand" }], matched: true },
  { id: 'v08', title: 'Cybertruck spawn', src: 'assets/videos/v08.mp4', poster: 'assets/videos/v08.jpg', level: 0, duration: 10.25,
    cam: { pos: [6.6, 1.02, -10.2], look: [5.55, -3.28, 3.5], fov: 66.0, roll: 0.0, t: 5.12 }, people: [{ pos: [6.31, -0.95, -7.89], yaw: 0.0, pose: "lean" }], matched: true },
  { id: 'v09', title: 'Front planter, take 2', src: 'assets/videos/v09.mp4', poster: 'assets/videos/v09.jpg', level: 0, duration: 7.45,
    cam: { pos: [9.0, 1.5, 4.1], look: [7.3, -1.0, -5.7], fov: 70.0, roll: 0.0, t: 6.33 }, people: [{ pos: [8.27, 0.46, 2.4], yaw: -2.5, pose: "sit" }, { pos: [9.05, 0.0, 2.04], yaw: 3.1, pose: "stand" }], matched: true },
  { id: 'v10', title: 'Slider shades', src: 'assets/videos/v10.mp4', poster: 'assets/videos/v10.jpg', level: 0, duration: 9.15,
    cam: { pos: [12.5, 1.5, 17.9], look: [15.46, 0.64, 24.24], fov: 68.0, roll: 0.0, t: 0.4 }, people: [{ pos: [13.0, 0.0, 18.9], yaw: 1.08, pose: "stand" }], matched: true },
  { id: 'v11', title: "5'10 vs 5'11 vs 6'0 vs 6'1", src: 'assets/videos/v11.mp4', poster: 'assets/videos/v11.jpg', level: 0, duration: 8.85,
    cam: { pos: [9.0, 1.07, 19.24], look: [9.59, 1.13, 29.22], fov: 72.1, roll: 1.32, t: 4.42 }, people: [{ pos: [10.13, -0.1, 22.42], yaw: 0.0, pose: "stand" }, { pos: [9.53, -0.1, 22.62], yaw: 0.0, pose: "stand" }, { pos: [8.89, -0.1, 22.55], yaw: 0.0, pose: "stand" }, { pos: [8.31, -0.1, 22.25], yaw: 0.0, pose: "stand" }], matched: true },
  { id: 'v12', title: 'Getting debloated', src: 'assets/videos/v12.mp4', poster: 'assets/videos/v12.jpg', level: 0, duration: 15.25,
    cam: { pos: [13.25, 1.4, 15.83], look: [11.35, 1.4, 13.51], fov: 75.0, roll: -1.5, t: 0.4 }, people: [{ pos: [11.9, 0.0, 14.5], yaw: -2.35, pose: "stand" }], matched: true },
  { id: 'v13', title: 'Holy accuracy', src: 'assets/videos/v13.mp4', poster: 'assets/videos/v13.jpg', level: 0, duration: 15.35,
    cam: { pos: [18.25, 1.4, 17.95], look: [19.1, 0.735, 20.83], fov: 66.0, roll: 0.0, t: 7.67 }, people: [{ pos: [20.24, 0.46, 21.0], yaw: 0.0, pose: "sit" }, { pos: [19.65, 0.46, 21.0], yaw: 0.0, pose: "sit" }, { pos: [19.11, 0.46, 21.0], yaw: 0.0, pose: "sit" }, { pos: [18.4, 0.46, 21.0], yaw: 0.0, pose: "sit" }], matched: true },
];
