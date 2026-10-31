// 핸드폰 조립: 상태(phone.js) + 라이트(light.js) + 화면(ui.js) + 보조배터리(bank.js) + 스토리 연결.
// - E1(PHONE.BEGIN_EVENT) 시작 때 시작 배터리 확정, 시점(pov) 전환 때 핸드폰 교체, 체크포인트 'phone' 저장·복원.
// - 위치 표시 (단계 10): where() = 지금 서 있는 곳(data/map.json)이 먼저, 모르는 곳이면 사건의 place, 둘 다 없으면 '-'.
// - 보조배터리 (단계 10): powerbanks.json 좌표에 놓고(placeAll) 물체를 그린다(bankView.js).
import texts from '../../data/phone.json';
import bankData from '../../data/powerbanks.json';
import { PHONE } from '../config.js';
import { Phone } from './phone.js';
import { PhoneLight } from './light.js';
import { PhoneUI, fmt } from './ui.js';
import { PowerBanks, seenBy } from './bank.js';
import { BankView } from './bankView.js';

export function setupPhone({ scene, camera, story, touch, toast, collision, where = () => '' }) {
  const { runner, interactions } = story;
  const msgs = texts.messages;
  const phone = new Phone(PHONE);
  const light = new PhoneLight(scene, camera);
  const ui = new PhoneUI(texts, { touch, warnShow: PHONE.WARN_SHOW });
  const banks = new PowerBanks({
    phone, defs: bankData.powerbanks, interactions, seen: seenBy(runner.registry), msgs, toast, gain: PHONE.BANK_GAIN,
  });
  banks.placeAll();
  const view = collision ? new BankView(scene, banks, collision) : null;
  phone.onWarn = (n) => ui.warn(fmt(msgs.warn, { n }));
  phone.onDead = () => ui.warn(msgs.dead);

  const prevEvent = runner.onEvent;
  runner.onEvent = (id, phase) => {
    if (id === PHONE.BEGIN_EVENT && phase === 'start') phone.begin();
    prevEvent?.(id, phase);
  };
  const prevPov = runner.onPov;
  runner.onPov = (pov) => {
    phone.usePov(pov);
    prevPov?.(pov);
  };
  runner.checkpoints.register('phone', {
    save: () => phone.save(),
    load: (v) => {
      phone.load(v);
      banks.sync();
    },
  });

  return {
    phone,
    light,
    ui,
    banks,
    view,
    // E(대화·상호작용이 아닐 때) / 터치 📱
    toggleScreen() {
      if (phone.screenOpen) phone.closeScreen();
      else if (!phone.openScreen()) toast(msgs.deadTry);
    },
    // R / 터치 💡 (화면이 열려 있어도 동작)
    toggleLight() {
      if (!phone.lightOn && phone.dead) return toast(msgs.deadTry);
      toast(phone.toggleLight() ? msgs.lightOn : msgs.lightOff);
    },
    // 디버그 U: 플레이어 앞 DEBUG_BANK_AHEAD m 에 다음 보조배터리를 놓는다
    debugBank(pos, dir, level = 0) {
      const h = Math.hypot(dir.x, dir.z) || 1;
      const a = PHONE.DEBUG_BANK_AHEAD;
      return banks.debugPlaceNext(pos.x + (dir.x / h) * a, pos.z + (dir.z / h) * a, level);
    },
    reset() {
      banks.clear();
      phone.reset();
      banks.placeAll();
    },
    // 위치 표시 문구: 지금 서 있는 곳 > 사건 장소
    place: () => where() || runner.place(),
    update(dt) {
      phone.update(dt);
      light.sync(phone);
      light.update(dt);
      view?.update();
      const open = phone.screenOpen && !phone.dead;
      ui.update(dt, {
        open, level: phone.level, lightOn: phone.lightOn, low: phone.low,
        objective: open ? runner.objective() : '', place: open ? where() || runner.place() : '',
      });
    },
    hudLine() {
      const p = phone;
      return `핸드폰(${p.pov}) 배터리 ${p.battery.toFixed(2)}%  라이트 ${p.lightOn ? 'on' : 'off'}  화면 ${p.screenOpen ? 'open' : '-'}  보조배터리 ${[...p.picked].join(',') || '-'}${p.begun ? '' : '  (E1 전 임시값)'}`;
    },
  };
}
