// 2D(xz) 충돌: AABB + 원기둥. 축별 이동으로 벽 슬라이딩을 만든다.
// 바닥 높이(계단)와 발소리 재질 영역도 여기서 관리한다.

export class Collision {
  constructor() {
    this.boxes = [];
    this.circles = [];
    this.floors = []; // {x0,z0,x1,z1,h}
    this.surfaces = []; // {x0,z0,x1,z1,name} 나중에 추가된 것이 우선
  }

  box(x0, z0, x1, z1) {
    this.boxes.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  circle(x, z, r) {
    this.circles.push({ x, z, r });
  }

  floor(x0, z0, x1, z1, h) {
    this.floors.push({ x0, z0, x1, z1, h });
  }

  surface(x0, z0, x1, z1, name) {
    this.surfaces.push({ x0, z0, x1, z1, name });
  }

  hit(x, z, r) {
    for (const b of this.boxes) {
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    for (const c of this.circles) {
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = r + c.r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  // 축별로 나눠 이동 → 막힌 축만 취소되므로 벽을 따라 미끄러진다.
  move(pos, dx, dz, r) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (r * 0.5)));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (!this.hit(pos.x + sx, pos.z, r)) pos.x += sx;
      if (!this.hit(pos.x, pos.z + sz, r)) pos.z += sz;
    }
  }

  floorHeight(x, z) {
    let h = 0;
    for (const f of this.floors) {
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) h = Math.max(h, f.h);
    }
    return h;
  }

  surfaceAt(x, z) {
    for (let i = this.surfaces.length - 1; i >= 0; i--) {
      const s = this.surfaces[i];
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.name;
    }
    return 'brick';
  }
}
