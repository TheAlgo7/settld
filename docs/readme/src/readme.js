// Settld's README pictures, drawn by the README Kit (Work\Playbooks\README Kit\render.py).
// Every wide picture has a "-mobile" twin that the README swaps in on screens up to 600 px.
// The phone screens come from scripts/readme-shots.py: the live app in local mode with the built-in
// sample trip (invented people and places), at 393x852 and 2x.
const CORAL = '#ff6f58', INK = '#f5f3ef';
const WARM = (at) => `radial-gradient(900px 720px at ${at}, #43190f 0%, rgba(67,25,15,0) 70%), linear-gradient(180deg,#141210,#0b0a09)`;
const P = (src, x, y, w, rot = 0, z = 20, glow = null, light = false) =>
  ({ type: 'phone', src, x, y, w, rot, z, glow, bar: true, barColor: light ? '#1b1916' : '#f3efe8', bg: light ? '#f6f2ea' : '#000' });
const wideLine = { width: 20, color: CORAL, points: [[-40, 712], [400, 690], [800, 730], [1640, 650]] };
const tallLine = (y) => ({ width: 26, color: CORAL, points: [[-40, y], [400, y - 40], [800, y + 10], [1120, y - 50]] });
const panel = (head, sub, items, at = '74% 56%') => ({
  w: 1600, h: 760, bg: WARM(at), color: INK, accent: CORAL,
  head: { x: 76, y: 180, size: 150, max: 530, lines: head }, sub: { x: 80, width: 500, size: 27, text: sub },
  line: wideLine, items,
});
const tall = (head, sub, items, h = 1330) => ({
  w: 1080, h, bg: WARM('60% 72%'), color: INK, accent: CORAL,
  head: { x: 64, y: 80, size: 180, max: 950, lines: head }, sub: { x: 70, width: 930, size: 36, text: sub },
  line: tallLine(h - 40), items,
});

window.README = {
  name: 'Settld', icon: 'icon.png',
  layouts: {
    hero: {
      w: 1600, h: 820, bg: WARM('76% 58%'), color: INK, accent: CORAL,
      brand: { x: 80, y: 74, size: 30 },
      head: { x: 76, y: 236, size: 150, max: 600, lines: ['Split. Prove.', 'Settle.'] },
      sub: { x: 80, width: 500, size: 27, gap: 34, text: 'Shared expenses for trips, homes and groups, with the receipt, the payment proof and every edit kept together.' },
      line: { width: 20, color: CORAL, points: [[-40, 770], [300, 724], [640, 708], [900, 772], [1200, 714], [1640, 752]] },
      items: [P('expense.png', 760, 150, 250, -6), P('group.png', 1010, 90, 280, 0, 24), P('light.png', 1300, 150, 250, 6, 22, null, true)],
    },
    'hero-mobile': {
      w: 1080, h: 1350, bg: WARM('60% 76%'), color: INK, accent: CORAL,
      brand: { x: 70, y: 70, size: 38 },
      head: { x: 64, y: 196, size: 200, max: 950, lines: ['Split. Prove.', 'Settle.'] },
      sub: { x: 70, width: 930, size: 38, text: 'Shared expenses with the receipt, the payment proof and every edit kept together.' },
      line: { width: 26, color: CORAL, points: [[-40, 1300], [300, 1250], [600, 1296], [1120, 1222]] },
      items: [P('expense.png', 64, 700, 280, -6), P('group.png', 400, 680, 290, 0, 24), P('light.png', 736, 700, 280, 6, 22, null, true)],
    },

    proof: panel(['Proof stays', 'attached'], 'The receipt and the payment screenshot live with the expense, so nobody has to scroll back through a chat to find them.', [
      { type: 'pop', src: 'pop-proof.png', x: 700, y: 300, w: 330, rot: -4, radius: 24, z: 30 },
      P('expense.png', 1190, 90, 290, 4, 24, CORAL),
    ]),
    'proof-mobile': tall(['Proof stays', 'attached'], 'The receipt and the payment screenshot live with the expense, not in a chat.', [
      { type: 'pop', src: 'pop-proof.png', x: 60, y: 700, w: 420, rot: -4, radius: 26, z: 30 },
      P('expense.png', 650, 560, 340, 4, 24, CORAL),
    ]),

    settle: panel(['One transfer', 'each'], 'The settle plan clears every balance with at most one payment per person. Settld records it and never moves money.', [
      { type: 'pop', src: 'pop-settle.png', x: 640, y: 210, w: 500, rot: -3, radius: 24, z: 30 },
      P('settle.png', 1190, 90, 290, 4, 24, CORAL),
    ]),
    'settle-mobile': tall(['One transfer', 'each'], 'The settle plan clears every balance with at most one payment per person. It never moves money.', [
      { type: 'pop', src: 'pop-settle.png', x: 40, y: 640, w: 580, rot: -3, radius: 26, z: 30 },
      P('settle.png', 650, 560, 340, 4, 24, CORAL),
    ]),

    record: panel(['Every edit,', 'on the record'], 'Every add, edit and payment stays in the activity, newest first, and friends show what you owe across every group.', [
      P('activity.png', 960, 90, 280, -4, 24, CORAL), P('friends.png', 1260, 120, 270, 5, 22),
    ]),
    'record-mobile': tall(['Every edit,', 'on the record'], 'Every add, edit and payment stays in the activity, and friends net out across groups.', [
      P('activity.png', 90, 590, 330, -4, 24, CORAL), P('friends.png', 590, 620, 330, 5, 22),
    ], 1360),
  },
};
