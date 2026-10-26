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

## 터치 조작 (스마트폰·태블릿)

주 입력이 터치인 기기에서는 자동으로 터치 모드가 켜지고(`?touch=1` / `?touch=0` 으로 강제 가능), 품질은 Mid 로 시작합니다.

| 조작 | 기능 |
|---|---|
| 왼쪽 아래 조이스틱 | 이동 (살짝 밀면 느리게, **끝까지 밀면 달리기**) |
| 화면 드래그 | 시점 회전 (이동과 동시에 가능) |
| 오른쪽 아래 📱 / 💡 | 핸드폰 화면 열기·닫기 / 핸드폰 라이트 켜기·끄기 |
| 오른쪽 위 ☰ | 접이식 메뉴: 이상 현상, 음소거, 품질 순환, 헤드밥, 블룸·그레인·비네팅, 안개 ±, 점검 모드, HUD, 전체화면, 다음 사건·책 줍기·보조배터리 놓기·스토리 초기화(디버그) |

시작 화면을 터치하면 전체화면·가로 고정을 시도합니다(iPhone 은 지원하지 않아 무시). 세로로 들면 가로 모드 안내가 뜹니다.

## 스토리 엔진 (단계 0)

- 사건·대사·선택지는 `data/story.json`, 인물 표시 이름(가명)은 `data/characters.json` 한 곳에만 있다. 대사에는 `{dohyeon}` 같은 자리표시자만 쓰고, `{gyuha:이}` 처럼 쓰면 받침에 맞는 조사(이/가, 은/는, 을/를 …)가 붙는다.
- 코드는 `src/story/`: `flags.js`(플래그 4개·루트 판정), `registry.js`(사건 등록기·연속 발동 금지), `runner.js`(진행기), `ui.js`(자막·대화창·선택지), `interact.js`(E 상호작용), `setup.js`(조립).
- 대화창은 `E`/Enter/Space 또는 탭으로 넘기고, 선택지는 `W`/`S`·↑↓ 이동, `E` 결정, 숫자키 바로 선택, 터치는 버튼 탭. 제한 시간이 있으면 막대가 줄고, 무응답이면 기본값이 선택된다. 선택지가 떠 있는 동안 이동은 멈춘다.
- 실내 맵 전이라 사건은 디버그 키 `N`(터치 메뉴 "다음 사건")으로 순서대로 불러 확인한다. 신관 4층 책(`earlyBook` → R1)은 상호작용 사건이라 E5 이후·E7 전에 `J`(터치 메뉴 "책 줍기")로 줍는다. `~` HUD 에 진행 사건·루트·플래그가 보인다.
- `npm test`: 루트 판정(플래그 16조합)·자리표시자·등록기·진행기 단위 테스트 (Node 내장 테스트 러너, 브라우저 불필요).
- 촬영: `?shot=1&...&story=E5&line=1` (사건 E5 의 두 번째 화면 = 선택지).

## 핸드폰 (단계 0b-1)

손전등은 없어졌고 핸드폰 라이트가 유일한 조명이다 (결정 D6).
- `E`: 핸드폰 화면 열기/닫기 — 해야 할 것(사건 목표, 엔딩을 본 판이면 2회차 문구), 위치(사건 장소), 배터리. **우선순위**: ① 대화창·선택지가 떠 있으면 대화용 ② 근처(1.6 m)에 상호작용 대상이 있으면 상호작용 ③ 그 외 핸드폰.
- `R`: 라이트 켜기/끄기 (화면이 열려 있어도 동작).
- 배터리: E1 시작 때 86~92% 랜덤, 화면을 열 때마다 −2%, 라이트 20초당 −1%, 보조배터리 +15%(상한 100), 0% 면 라이트·목표·위치 사용 불가, 20%·10% 에 한 번씩 알림, 10% 이하에서 라이트가 더 어둡고 가끔 흐려짐(초당 3회 미만). 태민 시점은 55% 에서 따로 시작.
- 보조배터리 좌표는 맵 단계(1d)에서 넣는다. 지금은 디버그 `U`(터치 메뉴 "보조배터리 놓기")로 앞에 놓고 `E` 로 줍는다 (PB 마다 줍는 시점 `from` 사건 이후).
- 코드 `src/phone/`(phone 상태·light·ui·bank·setup), 문구 `data/phone.json`, 수치 `config.js` 의 `PHONE`.

## 배포 (GitHub Pages)

시작 화면 맨 아래에 **버전**이 표시된다: 큰 글씨 `v1.0` 과 그 아래 작은 글씨 커밋 해시. 번호는 `package.json` 의 `version`(major.minor)이고 `main` 에 반영할 때마다 올린다(`npm version minor --no-git-tag-version`). 해시가 방금 푸시한 커밋(`git log --oneline -1`)과 같으면 새 배포가 반영된 것이다. 해시 끝의 `+` 는 저장 안 된 변경이 있는 로컬 빌드, 로컬 개발 서버는 `dev · <해시>`. 마우스를 올리면 빌드 시각(KST)이 보인다.

`.github/workflows/pages.yml` 이 `main` 에 푸시될 때마다 `npm run build` 결과(`dist/`)를 배포합니다.
설정: 저장소 **Settings → Pages → Source: GitHub Actions** (이미 설정됨). 다른 브랜치에서도 배포하려면 워크플로의 `branches` 에 추가하고 **Settings → Environments → github-pages → Deployment branches** 에서 그 브랜치를 허용해야 합니다.
주소: `https://lagulee.github.io/schoolgame/`

## 조작

| 키 | 기능 | 키 | 기능 |
|---|---|---|---|
| WASD / Shift | 이동 / 달리기 | `B` / `G` / `V` | 블룸 / 그레인 / 비네팅 토글 |
| 마우스 | 시점 (ESC 해제) | `H` | 헤드밥 100% → 40% → 끔 |
| `E` / `R` | 핸드폰 화면 / 라이트 | `M` | 음소거 |
| `1` `2` `3` | 품질 Low / Mid / High | `E` | (대화 중) 넘기기·결정 → (근처) 상호작용 → 핸드폰 |
| `[` `]` | 안개 밀도 −/+ (0.015~0.04) | `L` | 점검 모드 (밝게, 형태 확인용) |
| `P` | 스크린샷 PNG 저장 | `~` | 디버그 HUD (FPS·드로우콜·삼각형 수) |
| `Y` | 이상 현상 강제 발동 (디버그) | `N` / `J` / `K` | 다음 사건 / 4층 책 줍기(`earlyBook`, E5 이후·E7 전) / 스토리 초기화 (디버그) |
| `U` | 보조배터리 앞에 놓기 (디버그) | | |

- Low: 후처리·그림자 끔 / Mid: 그림자·블룸 / High: 전체 효과 (그레이딩·그레인·비네팅·색수차, 바닥 안개 전 층)
- 그레인·비네팅 토글은 High 에서만 의미가 있습니다 (Mid 는 그레이딩 패스를 쓰지 않음).

## 촬영 모드와 검증 스크립트

`?shot=1` 쿼리로 시간 고정·포인터락 없음·HUD 숨김 상태에서 한 시점을 렌더하고 `window.__READY = true` 를 설정합니다.

```
/?shot=1&pos=0,1.6,12&yaw=0&pitch=4&light=0&q=high[&phone=1][&battery=8][&ev=lamp|led|figure][&inspect=1]
```

```bash
npm run build
npm run shots                         # config.js 의 SHOTS 시점을 screenshots/ 에 저장
npm run shots -- --only=02 --extra="ev=led" --suffix=_ev_led
npm run smoke                         # 클릭·키 입력·핸드폰·결정적 이동(충돌) 테스트, 콘솔 에러 수집 (?light=1 로 라이트 켠 채)
npm run touch                         # 모바일 에뮬레이션: 조이스틱·시점 드래그·버튼·메뉴·멀티터치 테스트
```

Playwright 브라우저가 없다면 `npx playwright install chromium` 을 먼저 실행하세요. headless Chromium 은 `--use-angle=swiftshader --ignore-gpu-blocklist` 플래그로 WebGL 을 켭니다.

## 개발 규칙

작업·푸시 규칙은 [`CLAUDE.md`](CLAUDE.md), 진행 기록은 [`PROGRESS.md`](PROGRESS.md) 에 있다. 요약: 빌드·`smoke`·`touch` 검증을 통과하면 `main` 에 병합·푸시하고, 실험적인 수정은 먼저 묻는다.

## 구조

```
src/
├─ main.js              부트스트랩, 루프, 키 입력, 품질 프리셋
├─ config.js            SCHOOL_NAME, 팔레트, 치수, 조명·후처리·이벤트 수치, 촬영 시점
├─ world/               buildings, facade(외벽 디테일 인스턴싱), entrance(현관·파도 통로), courtyard,
│                       props, surroundings(공원·상가), trees, ledSign, lighting, sky, fx
├─ materials/           texgen(노이즈·Sobel 법선), procedural(벽돌·포장·노이즈 표면), windowTex, library
├─ player/              controller, collision, headbob, touch
├─ phone/               phone(배터리 규칙), light(핸드폰 라이트), ui(화면), bank(보조배터리), setup
├─ post/                composer, gradeShader
├─ audio/               audio(앰비언트·위치음·이벤트음), footsteps
├─ events/              director (이상 현상 3종, 정적 구간)
└─ debug/               hud, screenshot
scripts/                shots.mjs(시각 검증), smoke.mjs(상호작용 테스트)
screenshots/            검증 라운드별 스크린샷
```
