'use strict';
// Map data. Boxes: [cx, yBottom, cz, w, h, d, mat]. Ramps: [cx, cz, w, d, yLow, yHigh, risesToward].
// Team 0 spawns at -z, team 1 at +z. Lists passed through mirrorZ() get a copy reflected across z = 0.
(() => {
  const flipDir = { 'z+': 'z-', 'z-': 'z+', 'x+': 'x+', 'x-': 'x-' };
  const mirrorZ = (boxes) => boxes.concat(boxes.map(b => [b[0], b[1], -b[2], b[3], b[4], b[5], b[6]]));
  const mirrorRampsZ = (rs) => rs.concat(rs.map(r => [r[0], -r[1], r[2], r[3], r[4], r[5], flipDir[r[6]]]));
  const bothX = (boxes) => boxes.flatMap(b => [b, [-b[0], b[1], b[2], b[3], b[4], b[5], b[6]]]);
  const bothXR = (rs) => rs.flatMap(r => [r, [-r[0], r[1], r[2], r[3], r[4], r[5], r[6] === 'x+' ? 'x-' : r[6] === 'x-' ? 'x+' : r[6]]]);
  const teamSpawns = (list) => ({ 0: list.map(s => [s[0], s[1], s[2], Math.PI]), 1: list.map(s => [s[0], s[1], -s[2], 0]) });

  G.MAPS = [];

  // ================================================================== THE HINGE
  {
    const sideBoxes = [
      // base deck, walls, roof
      [0, 0, -44, 24, 4, 12, 'base'],
      [0, 3.6, -37.9, 24, 0.4, 0.2, 'trim'],
      [0, 4, -49.6, 24, 9, 0.8, 'wall'],
      [0, 4, -49.05, 10, 4.4, 0.3, 'portal'],
      [0, 8.9, -49.05, 8, 4, 0.3, 'portal'],
      [-11.5, 4, -38.6, 1, 4.4, 1, 'metal'], [11.5, 4, -38.6, 1, 4.4, 1, 'metal'],
      [0, 8.4, -44, 25, 0.5, 12.6, 'base'],
      [0, 8.85, -37.85, 25, 0.15, 0.3, 'trim'],
      [-7, 4, -38.6, 6, 1.1, 0.6, 'trim'], [7, 4, -38.6, 6, 1.1, 0.6, 'trim'],
      [0, 0, -33, 4, 1.3, 1.2, 'crate'],
      // mid cover
      [-4, 0, -15, 2.4, 1.3, 2.4, 'crate'], [4, 0, -15, 2.4, 1.3, 2.4, 'crate'],
      [-16, 0, -12, 3, 2.2, 3, 'crate'], [16, 0, -12, 3, 2.2, 3, 'crate'],
      [0, 0, -25, 7, 1.2, 0.8, 'wall'],
      [24, 0, -7, 0.8, 3, 0.8, 'metal'],
      // edge portal slabs
      [31.6, 0, -20, 0.4, 6, 8, 'portal'], [-31.6, 0, -20, 0.4, 6, 8, 'portal'],
      [-24, 0, -4.15, 6, 4, 0.3, 'portal'],
      // lanes
      [-22, 0, -18, 1, 2.4, 8, 'wall'],
      [18, 0, -28, 3, 1.6, 3, 'crate'], [28, 0, -31, 2, 2.5, 6, 'wall'],
      [-27, 0, -34, 3, 1.5, 3, 'crate'],
      // floor portal pads
      [-14, -0.48, -26, 5, 0.5, 5, 'portal'], [14, -0.48, -26, 5, 0.5, 5, 'portal'],
      // railings with gaps to the void
      [32.75, 0, -40, 0.5, 1.1, 20, 'trim'], [-32.75, 0, -40, 0.5, 1.1, 20, 'trim'],
      [0, 0, -51.75, 66, 1.1, 0.5, 'trim'],
    ];
    const boxes = [
      [0, -3, 0, 66, 3, 104, 'floor'],
      [0, -9, 0, 44, 6, 80, 'metal'], [0, -18, 0, 14, 9, 30, 'base'], [0, -26, 0, 4, 8, 4, 'accent'],
      [0, 0, 0, 6, 10, 6, 'portal'],
      [-9, 0, 0, 6, 3, 10, 'base'], [9, 0, 0, 6, 3, 10, 'base'],
      [-9, 2.95, 0, 6.1, 0.1, 10.1, 'trim'], [9, 2.95, 0, 6.1, 0.1, 10.1, 'trim'],
      [24, 3, 0, 4, 0.5, 30, 'metal'], [24, 0, 0, 0.8, 3, 0.8, 'metal'],
      [-24, 0, 0, 8, 4, 8, 'base'],
      [32.75, 0, 0, 0.5, 1.1, 44, 'trim'], [-32.75, 0, 0, 0.5, 1.1, 44, 'trim'],
      ...mirrorZ(sideBoxes),
    ];
    const ramps = [
      ...mirrorRampsZ([
        [-15, -41, 6, 10, 0, 4, 'z-'], [15, -41, 6, 10, 0, 4, 'z-'],
        [-9, -8.5, 4, 7, 0, 3, 'z+'], [9, -8.5, 4, 7, 0, 3, 'z+'],
        [24, -19, 4, 8, 0, 3.5, 'z+'],
      ]),
      [-17, 0, 6, 4, 0, 4, 'x-'],
    ];
    G.MAPS.push({
      id: 'hinge', name: 'THE HINGE', sub: 'Orbital arena at golden hour. Long lanes, a portal spire, and a long way down.',
      bounds: [-33, 33, -52, 52], killY: -22, backdrop: 'islands', music: 'pad_hinge',
      theme: {
        sky: ['#1a2d5a', '#f2a466', '#5b4a68'], sunDir: [-0.4, 0.1, -0.9], sunColor: '#ffb27a', sunSize: 2.2, clouds: 0.6,
        lightDir: [-0.45, 0.85, -0.6], lightColor: '#ffd9b0', lightI: 2.7, hemiSky: '#a9c3ff', hemiGround: '#6b5040', hemiI: 0.95,
        fog: '#d79d76', fogNear: 110, fogFar: 520, exposure: 1.0,
        floor: '#8e8a84', floorLine: '#5f656d', floorGlow: 0.06, wall: '#6f6c68', wallLine: '#4a4846', base: '#bdb8ae', baseLine: '#7f7a72',
        metal: '#3a3f47', crate: '#2f3338', trim: '#d4d0c8', dust: '#ffd2a0', accent: '#3fb4ff', portalBase: '#e7edf6', portalGlow: '#36aaff', lamp: '#ffe2b0',
      },
      boxes, ramps,
      spawns: Object.assign(teamSpawns([[-6, 4, -45], [0, 4, -46], [6, 4, -45], [-15, 0, -33], [15, 0, -33], [-4, 8.9, -43], [4, 8.9, -43], [0, 0, -35.5]]), {
        ffa: [[0, 4, -45, Math.PI], [0, 4, 45, 0], [-24, 4, 0, -Math.PI / 2], [24, 3.5, 0, Math.PI / 2], [-9, 3, 0, -Math.PI / 2], [9, 3, 0, Math.PI / 2],
          [-26, 0, -30, Math.PI], [26, 0, 30, 0], [26, 0, -30, Math.PI], [-26, 0, 30, 0], [0, 0, -20, Math.PI], [0, 0, 20, 0]],
      }),
      pickups: [
        { type: 'rail', pos: [-24, 4, 0] }, { type: 'overshield', pos: [24, 3.5, 0] }, { type: 'rocket', pos: [0, 10, 0] },
        { type: 'frag', pos: [0, 0, -29.5] }, { type: 'frag', pos: [0, 0, 29.5] },
      ],
      hills: [[0, 0, -21, 5], [-9, 3, 0, 4.5], [24, 3.5, 0, 4], [0, 0, 21, 5], [9, 3, 0, 4.5], [-24, 4, 0, 4.2]],
      key: [4.5, 0, 0],
      cam: { r: 62, h: 30, look: [0, 4, 0] },
    });
  }

  // ================================================================== FOUNDRY
  {
    const side = [
      [0, -3, -25, 12, 3, 32, 'floor'],
      [0, 0, -41.5, 58, 12, 1, 'wall'],
      [-10.5, 0, -35, 1, 6, 10, 'wall'], [10.5, 0, -35, 1, 6, 10, 'wall'],
      [0, 6, -35, 22, 0.5, 11, 'base'],
      [-7.5, 0, -30, 6, 6, 0.8, 'wall'], [7.5, 0, -30, 6, 6, 0.8, 'wall'], [0, 4, -30, 9, 2, 0.8, 'wall'],
      [0, 3.7, -29.5, 9, 0.3, 0.2, 'trim'],
      [0, 0, -40.85, 8, 5, 0.3, 'portal'],
      [0, 6.1, -19.5, 3, 0.4, 20, 'metal'],
      [0, 6.1, -9, 14, 0.4, 2, 'metal'],
      ...bothX([
        [14, 0, -6, 3, 2, 3, 'crate'], [20, 0, -20, 2, 3, 6, 'crate'], [4, 0, -16, 2, 1.2, 2, 'crate'], [18, 0, -31, 3, 1.4, 3, 'crate'],
        [14, -0.48, -22, 5, 0.5, 5, 'portal'],
        [27.85, 7, -24, 0.3, 4, 8, 'portal'], [27.85, 0, -14, 0.3, 5, 7, 'portal'],
        [28, 8.5, -32, 0.3, 0.5, 3, 'lamp'],
      ]),
      [-6, 7, -30.2, 2, 0.3, 0.3, 'lamp'], [6, 7, -30.2, 2, 0.3, 0.3, 'lamp'],
    ];
    const boxes = [
      [-17, -3, 0, 22, 3, 82, 'floor'], [17, -3, 0, 22, 3, 82, 'floor'],
      [0, -32, 0, 12, 2, 18, 'dark'],
      [0, -0.4, 0, 12, 0.4, 2, 'metal'], [0, -0.4, 0, 2, 0.4, 18, 'metal'],
      [28.5, 0, 0, 1, 12, 82, 'wall'], [-28.5, 0, 0, 1, 12, 82, 'wall'],
      [8, 6.1, 0, 2, 0.4, 20, 'metal'], [-8, 6.1, 0, 2, 0.4, 20, 'metal'],
      [23, 0, 0, 8, 7, 14, 'base'], [-23, 0, 0, 8, 7, 14, 'base'],
      [18.85, 0, 0, 0.3, 6, 8, 'portal'], [-18.85, 0, 0, 0.3, 6, 8, 'portal'],
      [14, 6.1, 0, 10, 0.4, 2.5, 'metal'], [-14, 6.1, 0, 10, 0.4, 2.5, 'metal'],
      [28, 8.5, 0, 0.3, 0.5, 4, 'lamp'], [-28, 8.5, 0, 0.3, 0.5, 4, 'lamp'],
      [0, 11.5, 0, 1, 1, 60, 'dark'], [6, 4.5, 0, 0.3, 0.3, 18, 'lamp'], [-6, 4.5, 0, 0.3, 0.3, 18, 'lamp'],
      ...mirrorZ(side),
    ];
    const ramps = mirrorRampsZ([
      [13, -34, 3, 12, 0, 6.5, 'z-'], [-13, -34, 3, 12, 0, 6.5, 'z-'],
      [23, -11, 4, 8, 0, 7, 'z+'], [-23, -11, 4, 8, 0, 7, 'z+'],
    ]);
    G.MAPS.push({
      id: 'foundry', name: 'FOUNDRY', sub: 'Night shift at a dead smelter. Tight rooms, catwalks, and a pit that never gives anything back.',
      bounds: [-28, 28, -41, 41], killY: -14, backdrop: 'city', music: 'pad_foundry',
      theme: {
        sky: ['#03050b', '#173349', '#020307'], sunDir: [0.5, 0.42, 0.35], sunColor: '#a9c8ff', sunSize: 3, stars: true, clouds: 0.25,
        lightDir: [0.35, 1, 0.45], lightColor: '#ffc690', lightI: 1.55, hemiSky: '#40618f', hemiGround: '#24180e', hemiI: 0.85,
        fog: '#0c1724', fogNear: 45, fogFar: 230, exposure: 1.15,
        floor: '#4c525c', floorLine: '#2a2e35', floorGlow: 0.05, wall: '#3c424c', wallLine: '#23262c', base: '#727884', baseLine: '#454a54',
        metal: '#3f4651', crate: '#6e4426', trim: '#2c3038', dust: '#ffc890', accent: '#ffb347', portalBase: '#bcc6d4', portalGlow: '#35b2ff', lamp: '#ffc070',
      },
      boxes, ramps,
      spawns: Object.assign(teamSpawns([[-5, 0, -37], [0, 0, -38], [5, 0, -37], [-5, 6.5, -35], [5, 6.5, -35], [13, 0, -25], [-13, 0, -25], [0, 0, -34]]), {
        ffa: [[0, 0, -37, Math.PI], [0, 0, 37, 0], [-23, 7, 0, -Math.PI / 2], [23, 7, 0, Math.PI / 2], [-14, 0, 12, 0], [14, 0, -12, Math.PI],
          [-20, 0, -30, Math.PI], [20, 0, 30, 0], [0, 6.5, -20, Math.PI], [0, 6.5, 20, 0], [24, 0, -20, Math.PI], [-24, 0, 20, 0]],
      }),
      pickups: [
        { type: 'rocket', pos: [0, 0, 0] }, { type: 'rail', pos: [-23, 7, 0] }, { type: 'overshield', pos: [23, 7, 0] },
        { type: 'frag', pos: [0, 6.5, -19] }, { type: 'frag', pos: [0, 6.5, 19] },
      ],
      hills: [[-14, 0, 0, 5], [0, 0, 22, 4.5], [23, 7, 0, 4], [14, 0, 0, 5], [0, 0, -22, 4.5], [-23, 7, 0, 4]],
      key: [0, 0, 0],
      cam: { r: 44, h: 26, look: [0, 2, 0] },
    });
  }

  // ================================================================== MESA
  {
    const side = [
      [0, 0, -52, 76, 22, 2, 'rock'],
      [0, 0, -44, 18, 5, 8, 'base'],
      [0, 5, -47.65, 10, 4.5, 0.3, 'portal'],
      [0, 0, -39.85, 8, 4.4, 0.3, 'portal'],
      [0, 0, -27, 3, 1.3, 6, 'crate'],
      ...bothX([
        [6, 5, -40.3, 5, 1.1, 0.6, 'trim'],
        [8, 0, -22, 4, 2.5, 3, 'rock'], [30, 0, -32, 6, 3, 4, 'rock'], [15, 0, -35, 3, 1.5, 3, 'crate'], [14, 0, -14, 2, 1.4, 2, 'crate'],
        [22, -0.48, -30, 5, 0.5, 5, 'portal'],
      ]),
    ];
    const boxes = [
      [0, -3, 0, 74, 3, 104, 'ground'],
      [37, 0, 0, 2, 22, 104, 'rock'], [-37, 0, 0, 2, 22, 104, 'rock'],
      [24, 0, 0, 14, 8, 26, 'rock'], [-24, 0, 0, 14, 8, 26, 'rock'],
      [16.85, 0, 0, 0.3, 6, 10, 'portal'], [-16.85, 0, 0, 0.3, 6, 10, 'portal'],
      [0, 0, 0, 16, 2, 16, 'base'],
      [0, 1.95, 0, 16.1, 0.1, 16.1, 'trim'],
      ...bothX([[7.4, 2, 7.4, 1.2, 5, 1.2, 'metal'], [7.4, 2, -7.4, 1.2, 5, 1.2, 'metal']]),
      [0, 7, 0, 17, 0.6, 17, 'portal'],
      ...mirrorZ(side),
    ];
    const ramps = [
      ...mirrorRampsZ([
        [24, -19, 6, 12, 0, 8, 'z+'], [-24, -19, 6, 12, 0, 8, 'z+'],
        [0, -10, 6, 4, 0, 2, 'z+'],
        [11, -44, 4, 8, 0, 5, 'z-'], [-11, -44, 4, 8, 0, 5, 'z-'],
      ]),
      [10, 0, 4, 6, 0, 2, 'x-'], [-10, 0, 4, 6, 0, 2, 'x+'],
    ];
    G.MAPS.push({
      id: 'mesa', name: 'MESA', sub: 'Desert research post in a red canyon. Two mesas, a pavilion of doors, and nowhere to hide from the sun.',
      bounds: [-36, 36, -51, 51], killY: -20, backdrop: 'canyon', music: 'pad_mesa',
      theme: {
        sky: ['#3c7bd4', '#d2e4f0', '#d6bf9a'], sunDir: [0.45, 0.72, 0.35], sunColor: '#fff0d2', sunSize: 1.4, clouds: 0.35,
        lightDir: [0.45, 0.85, 0.35], lightColor: '#fff2dc', lightI: 3.0, hemiSky: '#bad6ff', hemiGround: '#a07e5a', hemiI: 0.9,
        fog: '#cdd9e0', fogNear: 140, fogFar: 650, exposure: 0.95,
        floor: '#d6d0c4', floorLine: '#9d968a', floorGlow: 0.0, wall: '#beb5a5', wallLine: '#867e70', base: '#d6d0c4', baseLine: '#9a948a',
        metal: '#4c535c', crate: '#5b544c', trim: '#e2ddd2', dust: '#fff0d8', accent: '#1fa6ff', portalBase: '#f2f5fa', portalGlow: '#22a3ff',
        ground: '#cfac80', groundLine: 0.04, rock: '#b4774c', lamp: '#fff0c8',
      },
      boxes, ramps,
      spawns: Object.assign(teamSpawns([[-5, 5, -45], [0, 5, -46], [5, 5, -45], [-4, 0, -37], [4, 0, -37], [12, 0, -35], [-12, 0, -35], [0, 0, -33]]), {
        ffa: [[0, 5, -45, Math.PI], [0, 5, 45, 0], [-24, 8, 0, -Math.PI / 2], [24, 8, 0, Math.PI / 2], [0, 2, 0, 0], [-30, 0, -20, Math.PI],
          [30, 0, 20, 0], [30, 0, -20, Math.PI], [-30, 0, 20, 0], [-12, 0, -26, Math.PI], [12, 0, 26, 0], [0, 7.6, 0, Math.PI]],
      }),
      pickups: [
        { type: 'rail', pos: [-24, 8, 0] }, { type: 'overshield', pos: [24, 8, 0] }, { type: 'rocket', pos: [0, 7.6, 0] },
        { type: 'frag', pos: [0, 0, -31] }, { type: 'frag', pos: [0, 0, 31] },
      ],
      hills: [[0, 2, 0, 6], [-24, 8, 0, 5], [0, 0, 24, 5], [24, 8, 0, 5], [0, 0, -24, 5]],
      key: [0, 2, 0],
      cam: { r: 46, h: 36, look: [0, 2, 0] },
    });
  }

  // ================================================================== DRYDOCK
  {
    const side = [
      [0, -7, -33, 20, 7, 26, 'floor'],
      [0, 0, -46, 70, 10, 1, 'wall'],
      [0, 0, -41, 22, 5, 8, 'base'],
      [0, 0, -45.35, 10, 6, 0.3, 'portal'],
      [0, 0, -36.85, 8, 4.4, 0.3, 'portal'],
      [0, 0, -30, 6, 1.3, 1.2, 'crate'],
      ...bothX([
        [7, 5, -37.3, 6, 1.1, 0.6, 'trim'],
        [22, 0, -10, 4, 2.2, 4, 'crate'], [16, 0, -28, 3, 1.5, 3, 'crate'], [28, 0, -34, 3, 2, 5, 'crate'],
        [26, 0, -25, 4, 9, 4, 'metal'], [23.85, 0, -25, 0.3, 6, 3.6, 'portal'],
        [20, -0.48, -16, 5, 0.5, 5, 'portal'],
        [7, -4.48, -10, 5, 0.5, 5, 'portal'],
        [4.15, -3.5, -7, 0.3, 5, 6, 'portal'],
        [33.75, 0, -36, 0.5, 1.1, 20, 'trim'],
        [9.75, 0, -20, 0.5, 1.1, 0.5, 'trim'],
      ]),
    ];
    const boxes = [
      [-22, -7, 0, 24, 7, 92, 'floor'], [22, -7, 0, 24, 7, 92, 'floor'],
      [0, -7, 0, 20, 3, 40, 'floor'],
      [0, -4, 0, 8, 7, 30, 'metal'],
      [0, 3, 0, 5, 3.5, 6, 'portal'],
      [0, 2.95, 0, 8.1, 0.1, 30.1, 'trim'],
      [7, 2.6, 0, 6, 0.4, 3, 'metal'], [-7, 2.6, 0, 6, 0.4, 3, 'metal'],
      [28, 0, 0, 2, 3, 10, 'wall'], [-28, 0, 0, 2, 3, 10, 'wall'],
      [33.75, 0, 0, 0.5, 1.1, 30, 'trim'], [-33.75, 0, 0, 0.5, 1.1, 30, 'trim'],
      [0, -20, 0, 50, 13, 90, 'dark'],
      ...mirrorZ(side),
    ];
    const ramps = [
      ...mirrorRampsZ(bothXR([[7, -17.5, 4, 5, -4, 0, 'z-'], [13, -41, 4, 8, 0, 5, 'z-']])),
      ...bothXR([[13, 0, 6, 3, 0, 3, 'x-']]),
    ];
    G.MAPS.push({
      id: 'drydock', name: 'DRYDOCK', sub: 'A ship-repair platform under a grey sky. A sunken basin, a hull on stands, door panels down both sides.',
      bounds: [-34, 34, -46, 46], killY: -18, backdrop: 'sea', music: 'pad_foundry',
      theme: {
        sky: ['#58616b', '#a7afb6', '#454c52'], sunDir: [0.2, 0.45, -0.5], sunColor: '#eef1f4', sunSize: 1, clouds: 0.9,
        lightDir: [0.25, 0.9, -0.4], lightColor: '#dde4ec', lightI: 1.7, hemiSky: '#9ba7b3', hemiGround: '#3a3936', hemiI: 1.15,
        fog: '#8d959c', fogNear: 60, fogFar: 340, exposure: 1.05,
        floor: '#6c6d6b', floorLine: '#4a4b4a', floorGlow: 0.04, wall: '#56595c', wallLine: '#3d3f42', base: '#a5a39b', baseLine: '#77756e',
        metal: '#34465a', crate: '#7e3a2a', trim: '#c9c7c0', accent: '#ffb347', portalBase: '#d4dae2', portalGlow: '#38b4ff', lamp: '#ffd59a', dust: '#e8eef4',
      },
      boxes, ramps,
      spawns: Object.assign(teamSpawns([[-5, 5, -41], [0, 5, -42], [5, 5, -41], [-12, 0, -33], [12, 0, -33], [0, 0, -33], [-20, 0, -30], [20, 0, -30]]), {
        ffa: [[0, 5, -41, Math.PI], [0, 5, 41, 0], [-22, 0, 0, -Math.PI / 2], [22, 0, 0, Math.PI / 2], [0, 3, -10, Math.PI], [0, 3, 10, 0],
          [-7, -4, -5, Math.PI], [7, -4, 5, 0], [-26, 0, -18, Math.PI], [26, 0, 18, 0], [26, 0, -18, Math.PI], [-26, 0, 18, 0]],
      }),
      pickups: [
        { type: 'rail', pos: [0, 6.5, 0] }, { type: 'rocket', pos: [-7, -4, 0] }, { type: 'overshield', pos: [7, -4, 0] },
        { type: 'frag', pos: [0, 0, -27] }, { type: 'frag', pos: [0, 0, 27] },
      ],
      hills: [[-7, -4, 0, 3.5], [22, 0, 0, 4.5], [0, 3, 10, 3.5], [7, -4, 0, 3.5], [-22, 0, 0, 4.5], [0, 3, -10, 3.5]],
      key: [0, 6.5, 0],
      cam: { r: 54, h: 30, look: [0, 0, 0] },
    });
  }

  G.mapById = id => G.MAPS.find(m => m.id === id) || G.MAPS[0];
})();
