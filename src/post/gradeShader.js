// 비네팅 + 필름 그레인 + 가장자리 색수차 + 컬러 그레이딩(그림자 청록 / 하이라이트 따뜻하게)
// OutputPass(톤매핑·sRGB) 뒤에서 표시 값 기준으로 동작한다.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.04 },
    uCA: { value: 0.0015 },
    uGrade: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uCA, uGrade;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      // 색수차: 중심에서 멀수록 R/B 를 반대 방향으로 밀어냄
      vec2 off = d * uCA * (r2 * 4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // 그레이딩: 휘도에 따라 청록 ↔ 따뜻한 색으로 분할 톤
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.90, 1.02, 1.07);
      vec3 highTint = vec3(1.06, 1.0, 0.91);
      vec3 graded = col * mix(shadowTint, highTint, smoothstep(0.08, 0.65, l));
      graded = mix(vec3(l), graded, 0.92); // 살짝 탈채도
      col = mix(col, graded, uGrade);
      // 비네팅
      col *= 1.0 - uVignette * smoothstep(0.15, 0.85, length(d * vec2(1.25, 1.0)) * 1.25);
      // 그레인: 매 프레임 시간 시드, 어두운 곳에서 조금 더 보이게
      float n = hash(gl_FragCoord.xy + fract(uTime * 13.17) * 1000.0) - 0.5;
      col += n * uGrain * (1.2 - l);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
