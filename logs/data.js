/**
 * consumed.today — logs/data.js
 * ─────────────────────────────────────────────
 * HOW TO ADD A NEW ENTRY — paste at the TOP:
 *
 * {
 *   date: "tuesday, june 2nd",
 *   physical: [
 *     { name: "rice and dal" },          // no image is fine too
 *   ],
 *   text:  [],
 *   audio: [],
 *   video: [
 *     { title: "Video Title", link: "https://example.com/video" },
 *     "Simple video name",  // or just a string
 *   ],
 * },
 *
 * IMAGES:
 *   - Create an `images/` folder inside consumed-today/
 *   - Drop your photo in there (jpg, png, webp — any works)
 *   - Set image: "images/yourfile.jpg"
 *   - Leave out `image` entirely if no photo for that item
 * ─────────────────────────────────────────────
 */

const logs = [
  {
    date: "Thursday, November 5th",
    dateShort: "05/11/26",
    physical: [
      { name: "rice and dal" },
    ],
    text:  [],
    audio: [],
    video: [
      { title: "But what is a neural network? | Deep learning chapter 1 (3Blue1Brown)", link: "https://www.youtube.com/watch?v=aircAruvnKk" },
    ],
  },
  {
    date: "Wednesday, November 4th",
    dateShort: "04/11/26",
    physical: [
    ],
    text:  [],
    audio: [],
    video: [],
  },
  {
    date: "Tuesday, November 3rd",
    dateShort: "03/11/26",
    physical: [
    ],
    text:  [],
    audio: [],
    video: [],
  },
  {
    date: "Monday, November 2nd",
    dateShort: "02/11/26",
    physical: [
    ],
    text:  [],
    audio: [],
    video: [],
  },
  {
    date: "Sunday, November 1st",
    dateShort: "01/11/26",
    physical: [
    ],
    text:  [],
    audio: [],
    video: [],
  },
];
