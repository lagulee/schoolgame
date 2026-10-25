import * as THREE from 'three';
import { DIM, LIT_WINDOWS } from '../config.js';
import { mat4, rng, instanced } from './geom.js';

// 외벽 디테일 생성기. 모든 벽면의 창·띠·패널·배수관을 모아 InstancedMesh 로 한 번에 만든다.
// 벽면 로컬 좌표: u = 벽을 따라(m), v = 높이(m), n = 벽 바깥 법선 방향(m)
export class FacadeKit {
  constructor(M) {
    this.M = M;
    this.lists = {
      frame: [], glass: [], curtain: [], lit: [], sill: [],
      band: [], blue: [], yellow: [], orange: [], coping: [], plinth: [],
      pipe: [], pipeHead: [], ac: [],
    };
    this.cctv = []; // {pos: Vector3, ry}
    this.litInfo = []; // {pos, normal, ry, id}
    this.rand = rng(7);
  }

  // f: {id, origin:[x,z], normal:[nx,nz], length, openings:[{u0,u1,v0,v1}], blueEvery, cctv, ac, pipes, noWindows}
  add(f) {
    const [ox, oz] = f.origin;
    const [nx, nz] = f.normal;
    const dx = nz;
    const dz = -nx;
    const ry = Math.atan2(nx, nz);
    const L = this.lists;
    const W = DIM.window;
    const H = DIM.floorH;
    const top = DIM.floors * H + DIM.parapet;
    const P = (u, v, n) => [ox + dx * u + nx * n, v, oz + dz * u + nz * n];
    const put = (list, u, v, n, sx, sy, sz) => {
      const [x, y, z] = P(u, v, n);
      list.push(mat4(x, y, z, ry, sx, sy, sz));
    };
    const open = f.openings ?? [];
    const blocked = (u0, u1, v0, v1) => open.some((o) => u1 > o.u0 && u0 < o.u1 && v1 > o.v0 && v0 < o.v1);

    // 수평 요소: 열린 구간을 피해 잘라 넣는다
    const strip = (list, v0, v1, n, depth) => {
      let segs = [[0, f.length]];
      for (const o of open) {
        if (v1 <= o.v0 || v0 >= o.v1) continue;
        segs = segs.flatMap(([a, b]) => {
          if (o.u1 <= a || o.u0 >= b) return [[a, b]];
          const r = [];
          if (o.u0 > a) r.push([a, o.u0]);
          if (o.u1 < b) r.push([o.u1, b]);
          return r;
        });
      }
      for (const [a, b] of segs) if (b - a > 0.05) put(list, (a + b) / 2, (v0 + v1) / 2, n, b - a, v1 - v0, depth);
    };

    // 붉은 가로띠 (층 슬래브 높이, 0.1m 돌출) + 화강암 기단 + 파라펫 두겁
    for (let k = 1; k <= DIM.floors; k++) {
      strip(L.band, k * H - DIM.band.h / 2, k * H + DIM.band.h / 2, DIM.band.out / 2, DIM.band.out + 0.02);
    }
    strip(L.plinth, 0, 0.5, 0.03, 0.08);
    strip(L.coping, top - 0.02, top + 0.12, 0.06, 0.28);

    const bays = Math.floor(f.length / DIM.bay);
    const off = (f.length - bays * DIM.bay) / 2;
    const blueEvery = f.blueEvery ?? 3;

    // 파란 세로 패널 (2층부터 꼭대기까지)
    if (!f.noWindows) {
      for (let b = 0; b <= bays; b += blueEvery) {
        const u = off + b * DIM.bay;
        if (u < 0.4 || u > f.length - 0.4) continue;
        let segStart = H;
        for (let v = H; v <= top; v += 0.3) {
          const end = v + 0.3 > top;
          if (blocked(u - 0.35, u + 0.35, v, v + 0.3) || end) {
            const vEnd = end ? top : v;
            if (vEnd - segStart > 0.5) put(L.blue, u, (segStart + vEnd) / 2, 0.035, 0.7, vEnd - segStart, 0.07);
            segStart = v + 0.3;
          }
        }
      }
    }

    // 창 (bay 당 2개), 아래 포인트 패널
    if (!f.noWindows) {
      for (let fl = 0; fl < DIM.floors; fl++) {
        const base = fl * H;
        for (let b = 0; b < bays; b++) {
          const bu = off + b * DIM.bay;
          const r = this.rand();
          if (fl > 0 && r < 0.11 && !blocked(bu + 0.35, bu + DIM.bay - 0.35, base + 0.2, base + 0.86)) {
            put(r < 0.06 ? L.yellow : L.orange, bu + DIM.bay / 2, base + 0.54, 0.03, DIM.bay - 0.7, 0.62, 0.06);
          }
          for (let w = 0; w < 2; w++) {
            const idx = b * 2 + w;
            const u = bu + DIM.bay * (w === 0 ? 0.3 : 0.7);
            const v = base + W.sill + W.h / 2;
            if (blocked(u - W.w / 2 - 0.1, u + W.w / 2 + 0.1, v - W.h / 2 - 0.1, v + W.h / 2 + 0.1)) continue;
            put(L.frame, u, v, 0.03, W.w + 0.14, W.h + 0.14, 0.1);
            put(L.sill, u, v - W.h / 2 - 0.1, 0.07, W.w + 0.26, 0.06, 0.16);
            const lit = LIT_WINDOWS.findIndex((lw) => lw.facade === f.id && lw.floor === fl && lw.index === idx);
            if (lit >= 0) {
              put(L.lit, u, v, 0.082, W.w, W.h, 1);
              const [x, y, z] = P(u, v, 0.09);
              this.litInfo[lit] = { pos: new THREE.Vector3(x, y, z), normal: new THREE.Vector3(nx, 0, nz), ry };
            } else {
              put(this.rand() < 0.28 ? L.curtain : L.glass, u, v, 0.082, W.w, W.h, 1);
            }
            // 에어컨 실외기 (일부 창 아래, 브래킷 위)
            if (f.ac && fl > 0 && this.rand() < f.ac) put(L.ac, u, base + 0.25, 0.25, 0.86, 0.62, 0.36);
          }
          // CCTV 돔: 층마다 몇 개, 창 아래 슬래브 바로 위
          if (f.cctv && this.rand() < f.cctv) {
            const u = bu + DIM.bay / 2;
            if (!blocked(u - 0.3, u + 0.3, base + 2.9, base + 3.4)) {
              const [x, y, z] = P(u, base + 3.3, 0.02);
              this.cctv.push({ pos: new THREE.Vector3(x, y, z), normal: new THREE.Vector3(nx, 0, nz), ry });
            }
          }
        }
      }
    }

    // 배수관: 양 끝 + 지정 위치
    const pipes = f.pipes ?? [0.35, f.length - 0.35];
    for (const u of pipes) {
      put(L.pipe, u, top / 2, 0.14, 1, top, 1);
      put(L.pipeHead, u, top - 0.5, 0.18, 0.3, 0.4, 0.3);
    }
  }

  finalize(root) {
    const M = this.M;
    const L = this.lists;
    const g = new THREE.Group();
    g.name = 'facadeDetail';
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1);
    const pipe = new THREE.CylinderGeometry(0.065, 0.065, 1, 8);
    const add = (geo, mat, list, cast = true) => {
      if (!list.length) return null;
      const im = instanced(geo, mat, list, { cast });
      g.add(im);
      return im;
    };
    add(box, M.redBand, L.band);
    add(box, M.bluePanel, L.blue);
    add(box, M.yellow, L.yellow);
    add(box, M.orange, L.orange);
    add(box, M.granite, L.plinth);
    add(box, M.curb, L.coping);
    add(box, M.frame, L.frame);
    add(box, M.sill, L.sill);
    add(plane, M.glass, L.glass, false);
    add(plane, M.glassCurtain, L.curtain, false);
    this.litMesh = add(plane, M.glassLit, L.lit, false);
    add(pipe, M.pipe, L.pipe);
    add(box, M.pipe, L.pipeHead);
    add(box, M.metalBox, L.ac);
    root.add(g);
    return g;
  }
}
