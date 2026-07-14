/**
 * Earth disc — object-fit: cover + object-position: center bottom (CSS parity).
 * Texture rotates around bottom-center pivot; camera never moves.
 */
export const earthDiscVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const earthDiscFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAngle;
  uniform float uTexAspect;

  varying vec2 vUv;

  const vec2 PIVOT = vec2(0.5, 1.0);

  vec2 rotateAround(vec2 p, vec2 pivot, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    p -= pivot;
    p = mat2(c, -s, s, c) * p;
    p += pivot;
    return p;
  }

  /** Square UV → texture UV with cover + bottom anchor. */
  vec2 coverBottomCenter(vec2 uv, float texAspect) {
    const float faceAspect = 1.0;
    vec2 st = uv;

    if (texAspect > faceAspect) {
      float scale = faceAspect / texAspect;
      st.x = (st.x - 0.5) / scale + 0.5;
    } else {
      float scale = texAspect / faceAspect;
      st.y = st.y * scale + (1.0 - scale);
    }

    return st;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = dot(centered, centered);
    if (dist > 0.25) discard;

    vec2 texUv = coverBottomCenter(vUv, uTexAspect);
    texUv = rotateAround(texUv, PIVOT, uAngle);

    vec4 color = texture2D(uMap, texUv);

    float edge = smoothstep(0.22, 0.25, dist);
    float leftShade = smoothstep(0.0, 0.38, centered.x + 0.5) * 0.62;
    float rightShade = smoothstep(0.0, 0.38, 0.5 - centered.x) * 0.62;
    float shade = max(leftShade, rightShade) * (1.0 - edge);

    color.rgb *= 1.0 - shade;
    color.a = 1.0;

    gl_FragColor = color;
  }
`
