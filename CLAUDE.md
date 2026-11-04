# 작업 지침 (이 저장소에서 Claude Code 가 따르는 규칙)

밤 학교 3D 룩 데모(Vite + Three.js). 설계는 `DEMO_SPEC.md`, 가정·한계는 `NOTES.md`, 실행법은 `README.md` 에 있다.
`main` 에 푸시되면 GitHub Pages 가 자동 배포하므로 **`main` 은 곧 공개 사이트**다.

## 현재 상태 (요약)

- 명세 S1~S14 구현 완료, 시각 검증 3회 수행. 스토리 단계 0·0②·0b-1(핸드폰, 손전등 제거)·0b-2(이동·스태미나)·0b-3(추격 엔진)·0b-4(퍼즐 실행기 골격)·1a(외부 확장: 본관 중정형·신관·3층 연결통로·운동장, 필로티는 얕은 입구)·1b(본관 실내 1~5층: 층별 충돌·계단·문·실내 분위기)·1c(신관 실내 1~5층·3층 연결통로·잠긴 연결문)·1d(맵 데이터 `data/map.json`·핸드폰 위치 이름·잠긴 문 소리·보조배터리 9개 배치·성능 점검)·0c(시작 흐름: 이름 입력 → 학교 앞 자유 탐색 → 현관 홀에서 E1, `src/story/prelude.js`·`src/ui/startFlow.js`)·2a(E1~E2: 동쪽 복도 진입 E2 → 추격 C1 → 숨기 P1 → 흔적, `src/scene/`·`src/story/triggers.js`, 사건 안 행동 줄 `{do}`)·2b(E3~E6: 연결문·교무실 열쇠·원경 귀신·신관 5층, 줍기·소리 `src/scene/steps.js`, 5층 책은 2회차만)·3(E7~E9: 정전·점프스케어 #1·P3 교실 수색 `src/scene/p3.js`·E9 4층 책, 행동 줄 `reach`·`blackout`·`scare`)·4a(E10~E12: 추격 C2·점프스케어 #2·기절·각성 `src/scene/faint.js`·P2 당직실 단서 `src/scene/p2.js`·E12 선택지, 행동 줄 `faint`)·4b(E13~E15: 45초 대기 E13·P4 교무실 열쇠 `src/scene/p4.js`·E14 시선 돌리기·점프스케어 #3·마지막 추격 C4(실제 계단 경로 40 m)·E15 쓰러짐·엔딩 C `src/scene/finale.js`, 행동 줄 `look`·`collapse`, 트리거 `wait`·`routes`)·5(단계 17: R2 — 당직과 함께 E13 P4·E14 점프스케어 #3·추격 C4 입구 5 m 앞 트리거 붙잡힘·엔딩 B, 행동 줄 `collapse caught`, 사건 필드 `objectiveDoneByFlag`·`freezeAfter`)·6a(단계 18: R1 앞부분 — E7 → R1-a 책 건네기 → R1-b P3 → 구관 4층 당직실 R1-c 당직 첫 만남·P2 → R1-d 잡담·검은 연기 퇴장, 행동 줄 `vanish` `src/scene/vanish.js`)·6b(단계 19: R1 뒷부분 — R1-e {mingeon} 시점 전환·P4(당직 함께) → R1-f 점프스케어 #2·당직 사망 → R1-g 추격 C3(C4 와 같은 실제 경로) → R1-h 주인공 시점 복귀·흔적·탈출·엔딩 A, 행동 줄 `switch` `src/scene/pov.js`(데이터 `story.switches`, 체크포인트 `pov` = 시점별 자리·스태미나)·`escape` `src/scene/escape.js`(`story.escapes`), 사건 필드 `withDuty`)·7(단계 20 마감: 실내 밝기 보정 5단계 `src/ui/brightness.js`·`brightnessUi.js`(localStorage, 키 `-` `=`, 터치 메뉴)·조명 구역(`Atmosphere.zoneTarget`, STORY 15장 표)·유도등 그림·테·점광원 자리·복선 13-3 혼자일 때 연출 `src/scene/alone.js`(데이터 `story.alone`, 속삭임 `src/audio/whisper.js`)·시작 화면 경고 문구·엔딩 카드 "처음부터 다시"(Enter)·3루트 회귀 `test/routes.test.mjs`, 수치 `FINISH` = `src/config/finish.js`)·8(단계 21: 옥상 수영장·엔딩 D·크레딧 — 구관 5층 북서쪽 계단(S2) 맨 위 옥상 문 → 암전 → 지붕 위 데크(층 5) `src/scene/roof.js`·`roofView.js`, 그리기 `src/world/roof/`(데크·수영장·난간·간판, 충돌 `addRoofCollision`), 데이터 `data/roof.json`, 수치 `ROOF` = `src/config/roof.js`, 간판 크레딧 = `credits.json`(+ 로컬 덮어쓰기), 옥상에 있는 동안 사건 정지(`roof.paused`))까지 main 반영 — 스토리 단계(0~8) 전부 끝. 남은 후보는 `PROGRESS.md` 5장(단계 19 버그 후보 2개 등). 핸드폰 "가는 길" 안내(v1.17): `src/world/nav.js`(A* 길 찾기)·`navGuide.js`(목표별 안내)·`data/nav.json`(목표 키 → 가는 곳). 사건 단계에서 목표 키(`story.json` objectives)를 추가하면 `nav.json` 에도 같은 키를 적는다(`nav.test` 가 확인). 큰 충돌·이동 경계는 `src/world/layout.js`, 실내 배치는 `data/mainInterior.json`·`data/annexInterior.json` → `src/world/interior/`(조립 `site.js`, 연결통로 `connector.js`), 충돌의 층은 `Collision` 의 `level`. 맵 데이터 `data/map.json`(로더 `src/world/mapData.js`, 평면에서 만드는 부분은 실내 배치를 바꾼 뒤 `npm run map`). 상세 이력·결정 이유·한계·다음 후보는 [`PROGRESS.md`](PROGRESS.md).
- 디버그 키·터치 메뉴 디버그 항목은 비밀번호(`DEBUG.password`)로 잠겨 있다(PC `` ` `` 키, 터치는 버전 글자 5번 탭으로 해제, 잠금 중 터치 메뉴 디버그 항목은 숨김). smoke·touch 는 `window.__DEBUG.gate` 나 입력 창으로 해제한 뒤 디버그 키를 쓴다. 새 디버그 키를 만들면 `main.js` 의 잠금 규칙(`FREE_CODES`)을 따른다.
- 현재 버전 `v1.26.1` (시작 화면에 `v1.26` + 작은 커밋 해시 표시). 번호는 `package.json` 하나로 관리하고 올리는 규칙은 아래 "main 자동 반영 규칙" 3번.
- 추가 완료: GitHub Pages 배포(`main` 푸시 → `dist/`), 터치 조작(조이스틱·드래그·📱💡·접이식 메뉴), 이 규칙 문서.
- 테스트: `npm run build` / `test`(스토리·핸드폰·스태미나·추격·퍼즐 단위 테스트, 추격 자동 시뮬레이션) / `smoke`(키보드·충돌·스토리·핸드폰·스태미나·추격·퍼즐·본관 실내·신관) / `touch`(터치·실내 문) / `shots`(스크린샷, 실내 시점 14~34). 모두 통과 상태. `test` 에 이동 경계(`layout.test.mjs`)·층 충돌(`collision-levels.test.mjs`)·본관 실내(`interior.test.mjs`)·신관·연결통로(`annex-interior.test.mjs`)·맵(`map.test.mjs`)·시작 흐름(`start-flow.test.mjs`)·E2 추격·숨기(`e2-scene.test.mjs`)·E3~E6(`e3e6.test.mjs`)·E7~E9(`e7e9.test.mjs`)·E10~E12(`e10e12.test.mjs`)·E13~E15(`e13e15.test.mjs`)·R2(`e17r2.test.mjs`)·R1-a~R1-d(`r1ad.test.mjs`)·R1-e~R1-h(`r1eh.test.mjs`, 공용 세계 `worldR1.mjs`)·3루트 회귀(`routes.test.mjs`: 학교 앞 → 엔딩 A·B·C 자동 진행, 점프스케어 수·깜빡임 초당 3회 미만, 세계 `worldFull.mjs`·진행 `routeDrive.mjs`·깜빡임 검사 `flicker.mjs`)·마감(`finish.test.mjs`)·옥상(`roof.test.mjs`) 포함. 새 사건·연출을 넣으면 `routeDrive.mjs` 의 순서와 `worldFull.mjs` 의 연결도 맞춘다. 매직 넘버 중 사건 연출(`SCENE`)은 `src/config/scene.js`, 마감 수치(`FINISH`)는 `src/config/finish.js`, 촬영 시점(`SHOTS`)은 `src/config/shots.js` 에 있고 `config.js` 가 다시 내보낸다. smoke·touch 는 시작 화면에서 이름을 넣어야 시작된다(`#name-input`), 사건 자동 진입은 `__DEBUG.prelude.enabled`·`__DEBUG.scenes.auto` 를 꺼서 막는다. 보조 스크립트: `npm run map`(map.json 다시 만들기), `npm run perf`(품질별 프레임·드로우콜), `node scripts/travel.mjs`(이동 시간 표).
- **미검증**: 실제 폰·GPU 에서의 FPS, 터치 감도, 소리(속삭임 포함), 실내 밝기(밝기 보정 기본값). headless 환경에서는 측정할 수 없었다.
- 스토리 구현 계획·단계 현황: [`docs/story/STAGES.md`](docs/story/STAGES.md) (기준 문서 `docs/story/STORY.md`).
- 작업을 마치면 `PROGRESS.md` 의 타임라인·한계·다음 후보를 갱신한다.

## 스토리 구현 작업 (단계별 세션)

스토리(`docs/story/STORY.md`)를 게임에 넣는 작업은 단계(0~7)로 나뉘며, **한 세션이 한 단계**를 맡는다.
시작하면 먼저 [`docs/story/STAGES.md`](docs/story/STAGES.md) 의 "세션 시작 절차"를 따른다. 다음 규칙은 이 작업에 한해 아래 "main 자동 반영 규칙"보다 **우선**한다.

- **v6 단계 작업은 브랜치를 따로 두지 않고 `main` 에 바로 반영(자동 배포)한다** (사용자 지시, 2026-10-26). 단계를 마치면 아래 "main 자동 반영 규칙"(검증 → 커밋 → 버전 올리기 → `main` fast-forward 푸시 → 보고)을 그대로 따르고, 보고는 `STAGES.md` 4장 형식으로 한다. 새 스레드는 `origin/main` 에서 시작한다. 검증이 하나라도 실패하면 `main` 에 넣지 않는다.
- **모델·추론 강도**: 단계를 시작할 때 `remaining-stages-9-21.md`(프로젝트 파일)의 해당 단계 프롬프트 첫머리에 적힌 모델과 추론 강도로 진행한다(사용자 지시, 2026-11-03). 세션 설정이 다르면 가능한 범위에서 맞추고, 못 맞추면 보고에 적는다.
- 손전등은 없애고 핸드폰 라이트만 쓴다. 외부와 건물 실내는 한 월드로 만든다 (`STAGES.md` 결정 D2·D6).
- 해당 단계 범위만 구현한다. 다음 단계 작업을 미리 하지 않는다.
- 이 저장소는 공개다. **실명(인물·학교)을 코드·데이터·문서·커밋 메시지에 쓰지 않는다.** 인물 이름은 `data/characters.json` 의 가명을 `{gyuha}` 같은 자리표시자로만 참조한다. 실명이 필요한 개인 빌드는 `.gitignore`한 `data/*.local.json` 덮어쓰기 파일로만 다룬다.
- 대사·분기·사건은 코드가 아니라 `data/*.json` 에 둔다. 사건 ID(E1~E15)와 플래그 이름은 STORY.md 그대로 쓴다.
- STORY.md 에 없는 내용을 새로 정했거나 [미확정] 항목을 만나면 임의로 정하지 말고 `STAGES.md` 인계 기록에 적고 사용자에게 묻는다.
- 단계를 마치면 `STAGES.md` 의 현황 표와 인계 기록을 갱신한다.

## main 자동 반영 규칙

수정 요청을 마칠 때마다 아래 순서로 `main` 까지 반영한다. (소유자가 정한 상시 지침이다.)

1. **검증** — 모두 통과해야 한다. 하나라도 실패하면 푸시하지 않고 원인과 결과를 보고한다.
   - `npm run build`
   - `npm run smoke` (키보드 조작·충돌·콘솔 에러)
   - `npm run touch` (터치 조작)
   - 외관·조명을 바꿨다면 `npm run build && npm run shots` 로 스크린샷을 찍어 눈으로 확인한다.
2. **커밋** — 의미 있는 단위로 한국어 메시지, 시스템이 지정한 attribution 줄을 붙인다.
3. **버전 올리기** — `main` 에 반영할 때마다 버전을 올린다. 버전은 `v1.15.0` 처럼 점이 두 개인 `major.minor.patch` 이고, 무엇을 했는지에 따라 올리는 자리가 다르다. (사용자 지시, 2026-11-01)
   - **버그·자잘한 오류 수정** → 점을 두 번 찍은 셋째 자리(patch)를 올린다: `npm version patch --no-git-tag-version` (예: `v1.15.0` → `v1.15.1` → `v1.15.2`).
   - **단계 진행 같은 큰 업데이트** → 점을 한 번 찍은 둘째 자리(minor)를 올리고 셋째 자리는 0으로 되돌린다: `npm version minor --no-git-tag-version` (예: `v1.15.2` → `v1.16.0`, 읽을 때는 `v1.16`). 엄청나게 큰 개편만 `major`.
   - 둘이 섞인 작업이면 큰 쪽(minor)을 따른다. `package.json` 이 유일한 기준이고 `package-lock.json` 도 같이 바뀐다. 버전 변경은 그 커밋에 함께 넣는다. (작업 브랜치에만 푸시하는 중간 커밋에서는 올리지 않는다.)
   - 참고: 시작 화면 큰 글씨는 현재 `major.minor`(`v1.15`)만 보여 주고 patch 는 `package.json` 과 커밋 해시로 구분한다.
4. **main 병합** — 작업 브랜치에서 `main` 으로 병합한다.
   - `git fetch origin main` 후 `git merge origin/main` 으로 작업 브랜치에 먼저 합친다. rebase·amend·force-push 는 하지 않는다.
   - 충돌은 양쪽 의도를 보존해 해결한다. 같은 로직을 서로 다르게 바꾼 충돌은 임의로 고르지 말고 묻는다.
   - `main` 에서 새 변경이 들어왔다면 1번 검증을 다시 한다.
   - 그다음 `git push origin HEAD:main` (fast-forward) 과 `git push -u origin <작업 브랜치>` 를 한다.
5. **보고** — 푸시한 커밋, 새 버전 번호, 검증 결과, 공개 사이트(`https://lagulee.github.io/schoolgame/`)가 곧 갱신된다는 점, Actions 탭에서 배포 확인이 필요하다는 점을 알린다.

### 푸시 전에 먼저 물어보는 경우

- 실험적이거나 되돌릴 가능성이 있는 수정 (예: 외관을 크게 바꾸는 시도, 구조 개편, 수치 대폭 조정)
- 사용자가 "확인해 보고", "일단 해 봐", "초안" 처럼 검토를 전제로 말한 경우
- 새 의존성·워크플로·저장소 설정을 바꾸는 수정
- 병합 충돌이 로직 충돌인 경우

이때는 작업 브랜치에만 푸시하고, `main` 반영 여부를 묻는다.

### 하지 않는 것

- `main` 강제 푸시, 이력 재작성
- 테스트를 건너뛰거나 꺼서 통과시키기
- 요청받지 않은 PR 생성
- 학교 실명, 상가 간판 글자, 전화번호를 코드·텍스처에 넣기 (`config.js` 의 `SCHOOL_NAME` 가명만 사용)

## 코드 규칙

- 파일 하나는 400줄 이하로 유지한다.
- 매직 넘버는 `src/config.js` 에 둔다.
- 외부 에셋과 네트워크 다운로드는 금지한다 (런타임 의존성은 `three` 하나, 개발용은 `vite`, `playwright`).
- 깜빡임은 초당 3회 미만을 지킨다 (광과민성 안전).
