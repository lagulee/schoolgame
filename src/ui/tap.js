// 버튼 누름을 pointerdown 에서 처리한다. 다른 손가락이 조이스틱·시점 영역을 누르고 있으면
// 모바일 브라우저가 두 번째 손가락의 click 을 만들지 않는 경우가 있어, 이동하면서도 버튼이 눌리게 한다.
// 키보드(Enter·Space)로 누른 click(detail 0)만 따로 받는다. 마우스·터치 click(detail ≥ 1)은 pointerdown 에서 이미 처리했으므로 무시.
export function onTap(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.detail === 0) fn(e);
  });
}
