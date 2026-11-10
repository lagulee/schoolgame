import { PERF_TUNE } from '../config.js';

// 셰이더·텍스처 미리 준비 (렉 수정, v1.28.8).
// 원인: three 는 재질의 셰이더를 "그 재질이 처음 화면에 그려질 때" 만든다. 광원 수(핸드폰 라이트 켬/끔, 바깥/실내 점광원 예산)가
// 바뀌면 재질마다 다른 셰이더가 필요한데, 예전 준비 방식(시작 자리에서 한 장씩 그리기)은 시야 안에 있던 재질만 만들어 두었다.
// 그래서 현관 홀에서 라이트를 처음 켜면 34개, 새 구역에 들어설 때마다 30여 개가 게임 도중 컴파일되어 화면이 멈췄다.
// 조치 1: renderer.compile 은 시야와 무관하게 장면의 모든 재질을 만든다 → 네 가지 광원 상태(가로등 켬/끔 × 라이트 켬/끔)를 모두 미리 만든다.
//   브라우저가 병렬 컴파일(KHR_parallel_shader_compile)을 지원하면 이름을 입력하는 동안 뒤에서 끝난다.
// 조치 2: 그림자용 깊이 셰이더·정점 버퍼·텍스처는 compile 이 다루지 않는다 → 시야 가리기를 끈 채 화면 1픽셀에만 한 번 그려서(drawAll) 올린다.
//   지금 상태는 바로, 나머지 세 상태는 시작 화면이 떠 있는 동안 PERF_TUNE.preload.later 초 간격으로 하나씩.
export function prewarmShaders({ renderer, scene, camera, lights, phoneLight, post, groups = [], later = true, hold = () => false }) {
  const target = () => (post.enabled ? post.composer.renderTarget1 : null); // 후처리를 쓰면 렌더 타깃에 그린다 (색 공간·톤매핑이 달라 셰이더도 다르다)
  // 광원 상태를 잠깐 바꿔 run 을 부르고 되돌린다
  const inState = (lampsOn, lightOn, run) => {
    const saved = groups.map((g) => g.visible);
    const was = [lights.outdoorLamps(), phoneLight.on, renderer.getRenderTarget()];
    for (const g of groups) g.visible = true;
    lights.setOutdoorLamps(lampsOn);
    phoneLight.setOn(lightOn);
    renderer.setRenderTarget(target());
    run();
    renderer.setRenderTarget(was[2]);
    phoneLight.setOn(was[1]);
    lights.setOutdoorLamps(was[0]);
    groups.forEach((g, i) => { g.visible = saved[i]; });
  };
  const drawAll = () => {
    const culled = [];
    scene.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    lights.redrawMoon();
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    for (const o of culled) o.frustumCulled = true;
    lights.redrawMoon(); // 다음 프레임에 제대로 다시
  };
  const states = [];
  for (const lampsOn of [true, false]) for (const lightOn of [phoneLight.on, !phoneLight.on]) states.push([lampsOn, lightOn]);
  for (const [a, b] of states) inState(a, b, () => renderer.compile(scene, camera));
  uploadTextures(renderer, scene);
  inState(...states[0], drawAll);
  post.render(0);
  // 나머지 상태: 하나씩 나중에. hold() = 일시정지 중이면 미룬다. 반환값 = 취소 함수 (품질을 다시 바꿀 때)
  let i = later ? 1 : states.length;
  let timer = 0;
  const next = () => {
    if (i >= states.length) return;
    if (!hold()) inState(...states[i++], drawAll);
    timer = setTimeout(next, PERF_TUNE.preload.later * 1000);
  };
  timer = setTimeout(next, PERF_TUNE.preload.later * 1000);
  return () => { i = states.length; clearTimeout(timer); };
}

// 텍스처를 처음 볼 때가 아니라 지금 GPU 에 올린다 (새 방에 들어설 때의 짧은 끊김 방지). 큰 텍스처·개수 한도는 PERF_TUNE.preload
function uploadTextures(renderer, scene) {
  const seen = new Set();
  const P = PERF_TUNE.preload;
  const add = (t) => {
    if (!t?.isTexture || t.isRenderTargetTexture || t.isVideoTexture || seen.has(t) || seen.size >= P.maxTextures) return;
    const img = t.image;
    if (!img || !(img.width > 0) || img.width * img.height > P.maxPixels) return;
    seen.add(t);
    renderer.initTexture(t);
  };
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const k in m) add(m[k]);
      if (m.uniforms) for (const k in m.uniforms) add(m.uniforms[k]?.value);
    }
  });
  return seen.size;
}

// main.js 용: now() = 바로 준비 (로딩), soon() = 조금 뒤에 준비 (품질 변경: 연달아 바꾸면 마지막 것만, 일시정지 중이면 미룬다)
export function prewarmer(opts) {
  let stop = null;
  let timer = 0;
  const wait = PERF_TUNE.preload.debounce * 1000;
  const now = () => {
    if (opts.hold?.()) { timer = setTimeout(now, wait); return; }
    stop?.();
    stop = prewarmShaders(opts);
  };
  return { now, soon() { stop?.(); clearTimeout(timer); timer = setTimeout(now, wait); } };
}
