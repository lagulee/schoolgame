# 밤 학교 3D 룩 데모 (schoolgame)

스토리·게임 로직 없이 **밤 학교 외형과 공포게임 특유의 3D 룩**(조명·안개·후처리·소리·카메라)을 걸어 다니며 평가하는 데모입니다.
작업 명세는 [`DEMO_SPEC.md`](DEMO_SPEC.md), 가정·한계·검증 결과는 [`NOTES.md`](NOTES.md)에 있습니다.

- Vite + Three.js(r186), JavaScript ES modules. 런타임 의존성은 `three` 하나
- 텍스처와 소리는 전부 코드로 생성 (외부 에셋 없음)

## 실행

```bash
npm install
npm run dev        # http://localhost:5173 접속 → 화면 클릭으로 시작
npm run build      # dist/ 로 빌드
npm run preview    # 빌드 결과 확인
```

시작할 때 절차 텍스처를 만드느라 몇 초 걸립니다("텍스처 생성 중…"). 헤드폰을 권장합니다.

## 조작

| 키 | 기능 | 키 | 기능 |
|---|---|---|---|
| WASD / Shift | 이동 / 달리기 | `B` / `G` / `V` | 블룸 / 그레인 / 비네팅 토글 |
| 마우스 | 시점 (ESC 해제) | `H` | 헤드밥 100% → 40% → 끔 |
| `F` | 손전등 | `M` | 음소거 |
| `1` `2` `3` | 품질 Low / Mid / High | `E` | 이벤트 강제 발동 |
| `[` `]` | 안개 밀도 −/+ (0.015~0.04) | `L` | 점검 모드 (밝게, 형태 확인용) |
| `P` | 스크린샷 PNG 저장 | `~` | 디버그 HUD (FPS·드로우콜·삼각형 수) |

- Low: 후처리·그림자 끔 / Mid: 그림자·블룸 / High: 전체 효과 (그레이딩·그레인·비네팅·색수차, 바닥 안개 전 층)
- 그레인·비네팅 토글은 High 에서만 의미가 있습니다 (Mid 는 그레이딩 패스를 쓰지 않음).

## 촬영 모드와 검증 스크립트

`?shot=1` 쿼리로 시간 고정·포인터락 없음·HUD 숨김 상태에서 한 시점을 렌더하고 `window.__READY = true` 를 설정합니다.

```
/?shot=1&pos=0,1.6,12&yaw=0&pitch=4&flash=0&q=high[&ev=lamp|led|figure][&inspect=1]
```

```bash
npm run build
npm run shots                         # config.js 의 SHOTS 시점을 screenshots/ 에 저장
npm run shots -- --only=02 --extra="ev=led" --suffix=_ev_led
npm run smoke                         # 클릭·키 입력·결정적 이동(충돌) 테스트, 콘솔 에러 수집
```

Playwright 브라우저가 없다면 `npx playwright install chromium` 을 먼저 실행하세요. headless Chromium 은 `--use-angle=swiftshader --ignore-gpu-blocklist` 플래그로 WebGL 을 켭니다.

## 구조

```
src/
├─ main.js              부트스트랩, 루프, 키 입력, 품질 프리셋
├─ config.js            SCHOOL_NAME, 팔레트, 치수, 조명·후처리·이벤트 수치, 촬영 시점
├─ world/               buildings, facade(외벽 디테일 인스턴싱), entrance(현관·파도 통로), courtyard,
│                       props, surroundings(공원·상가), trees, ledSign, lighting, sky, fx
├─ materials/           texgen(노이즈·Sobel 법선), procedural(벽돌·포장·노이즈 표면), windowTex, library
├─ player/              controller, collision, flashlight, headbob
├─ post/                composer, gradeShader
├─ audio/               audio(앰비언트·위치음·이벤트음), footsteps
├─ events/              director (이상 현상 3종, 정적 구간)
└─ debug/               hud, screenshot
scripts/                shots.mjs(시각 검증), smoke.mjs(상호작용 테스트)
screenshots/            검증 라운드별 스크린샷
```
