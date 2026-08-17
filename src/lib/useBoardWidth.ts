import { useEffect, useRef, useState } from "react";

/**
 * 보드를 감싼 요소의 폭을 재서 react-chessboard 에 넘길 픽셀 값을 만든다.
 * 값을 안 주면 560px 고정이라 휴대폰에서 화면 밖으로 나간다.
 */
export function useBoardWidth(max = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // 테두리와 안쪽 여백을 뺀 실제 사용 가능 폭
      const style = getComputedStyle(el);
      const pad =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const avail = el.clientWidth - pad;
      setWidth(Math.max(240, Math.min(max, Math.floor(avail))));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);

  return { ref, width };
}
