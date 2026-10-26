/* GLSL for the coffee story: morphing particles, neural fibres, nodes, halo, dust, rings. */

const NOISE = /* glsl */ `
  float hash13(vec3 p){
    p = fract(p * .1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.-2.*f);
    return mix(
      mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y),
      f.z);
  }
`;

/* ─────────────── main particle body: bean → cup → head ─────────────── */
export const particleVert = /* glsl */ `
  attribute vec3 aCup;
  attribute vec3 aHead;
  attribute vec4 aRand;

  uniform float uStage;   // 0 bean · 1 cup · 2 head
  uniform float uTime;
  uniform float uPx;
  uniform float uSize;
  uniform float uIgnite;  // 0 sleepy brain · 1 fully awake
  uniform float uReveal;
  uniform vec3  uBrain;

  varying vec3  vColor;
  varying float vAlpha;

  vec3 flow(vec3 p, float t){
    return vec3(
      sin(p.y*1.35 + t + aRand.x*6.283),
      sin(p.z*1.15 - t*1.2 + aRand.y*6.283),
      sin(p.x*1.25 + t*.8 + aRand.z*6.283));
  }

  void main(){
    float s = uStage;
    vec3 A = position;
    vec3 B = aCup;
    float t = s;
    if (s >= 1.0) { A = aCup;  B = aHead; t = s - 1.0; }
    if (s >= 2.0) { A = aHead; B = aHead; t = 0.0; }

    // each particle leaves at its own moment: low ones first, scattered a little
    float delay = .46 * (.55 * aRand.w + .45 * clamp(A.y * .25 + .5, 0., 1.));
    float e = smoothstep(0., 1., clamp((t - delay) / (1. - .46), 0., 1.));
    float travel = sin(3.14159 * e);

    vec3 pos = mix(A, B, e);
    pos += flow(pos * .8, uTime * .35) * travel * (.32 + aRand.x * .55);   // swirl while travelling
    pos += flow(pos * 1.7, uTime * .5) * .014;                             // idle shimmer

    // the awakening: a shock-wave leaves the brain, then the head keeps breathing
    float headW = smoothstep(1.4, 2.0, s);
    vec3 fromBrain = pos - uBrain;
    float r = length(fromBrain) + .0001;
    float front = uIgnite * 6.5;
    float wave = exp(-pow((r - front) * 1.6, 2.)) * smoothstep(0., .08, uIgnite) * (1. - smoothstep(.85, 1., uIgnite));
    pos += fromBrain / r * wave * .5 * headW;
    pos += fromBrain / r * uIgnite * headW * (.025 + .03 * sin(uTime * 2. + aRand.x * 40.));

    vec4 mv = modelViewMatrix * vec4(pos, 1.);
    gl_Position = projectionMatrix * mv;

    // — colour —
    // monochrome palette: steel greys while tired, white when the caffeine arrives
    vec3 cBean  = vec3(.66, .63, .6);
    vec3 cCup   = mix(vec3(.8, .82, .84), vec3(1.), aRand.y * .7);
    vec3 cSleep = mix(vec3(.3, .32, .35), vec3(.52, .54, .57), aRand.y);
    vec3 cAmber = mix(vec3(.9, .91, .93), vec3(1.), aRand.y);

    vec3 col = mix(cBean, cCup, smoothstep(0., 1., s));
    col = mix(col, cSleep, smoothstep(1., 2., s));
    float awake = smoothstep(0., .55, uIgnite * 1.7 - length(aHead - uBrain) * .3);
    col = mix(col, cAmber, awake * headW);
    col += wave * headW * vec3(.3, .3, .32);
    vColor = col;

    // — alpha —
    float lowFade = smoothstep(-2.0, -.75, aHead.y);             // bust dissolves into the dark
    float a = .62 + .38 * sin(uTime * (1. + aRand.w * 2.) + aRand.x * 30.);
    a *= mix(1., lowFade, headW);
    a *= mix(.32, 1., smoothstep(0., .35, s));                   // sparse sparkle on the solid bean
    vAlpha = a * uReveal;

    float size = uSize * (.55 + aRand.z * .9) * (1. + .6 * travel + .8 * wave * headW);
    gl_PointSize = size * uPx * (10. / -mv.z);
  }
`;

export const particleFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - .5);
    float a = smoothstep(.5, 0., d);
    a *= a;
    if (a < .01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

/* ─────────────── neural fibres (line segments) ─────────────── */
export const fibreVert = /* glsl */ `
  attribute float aT;
  attribute float aPhase;
  attribute float aD;
  uniform float uTime;
  uniform float uIgnite;
  uniform float uShow;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    float local = smoothstep(aD * .9, aD * .9 + .22, uIgnite * 1.18);
    float speed = mix(.16, .85, local);
    float head = fract(uTime * speed + aPhase);
    float pulse = smoothstep(.2, 0., abs(aT - head));
    float glow = .16 + pulse * mix(.9, 2.4, local);
    vec3 sleep = vec3(.32, .34, .38);
    vec3 awake = vec3(1.);
    vColor = mix(sleep, awake, local) * glow;
    vAlpha = uShow * mix(.55, 1., local);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
export const fibreFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main(){ gl_FragColor = vec4(vColor, vAlpha); }
`;

/* ─────────────── neurons (points) ─────────────── */
export const nodeVert = /* glsl */ `
  attribute float aD;
  attribute float aSeed;
  uniform float uTime;
  uniform float uIgnite;
  uniform float uShow;
  uniform float uPx;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    float local = smoothstep(aD * .9, aD * .9 + .22, uIgnite * 1.18);
    float tw = .5 + .5 * sin(uTime * mix(1.2, 5., local) + aSeed * 40.);
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (3.2 + tw * 3. + local * 4.) * uPx * (10. / -mv.z);
    vColor = mix(vec3(.5, .52, .56), vec3(1.), local) * (.7 + tw * .6 + local * .8);
    vAlpha = uShow;
  }
`;

export const nodeFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - .5);
    float a = smoothstep(.5, 0., d);
    gl_FragColor = vec4(vColor, a * a * vAlpha);
  }
`;

/* ─────────────── background halo ─────────────── */
export const haloVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
export const haloFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uTime;
  varying vec2 vUv;
  void main(){
    vec2 p = vUv - .5;
    float d = length(p * vec2(1., 1.08));
    float g = exp(-d * d * 9.) * .9 + exp(-d * d * 2.4) * .35;
    g *= .96 + .04 * sin(uTime * .8);
    gl_FragColor = vec4(uColor * g * uStrength, g * uStrength);
  }
`;

/* ─────────────── drifting dust ─────────────── */
export const dustVert = /* glsl */ `
  attribute vec4 aRand;
  uniform float uTime;
  uniform float uPx;
  uniform vec3 uBox;
  varying float vA;
  void main(){
    vec3 p = position;
    p.y = mod(p.y + uTime * (.08 + aRand.x * .22) + uBox.y, uBox.y * 2.) - uBox.y;
    p.x += sin(uTime * .3 + aRand.y * 20.) * .35;
    p.z += cos(uTime * .25 + aRand.z * 20.) * .35;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + aRand.w * 3.) * uPx * (10. / -mv.z);
    vA = (.25 + aRand.w * .6) * (.5 + .5 * sin(uTime * (.6 + aRand.x) + aRand.y * 30.));
  }
`;
export const dustFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main(){
    float d = length(gl_PointCoord - .5);
    float a = smoothstep(.5, 0., d);
    gl_FragColor = vec4(uColor, a * a * vA);
  }
`;

/* ─────────────── orbit rings (shown once the brain is awake) ─────────────── */
export const ringVert = /* glsl */ `
  varying vec2 vP;
  void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
export const ringFrag = /* glsl */ `
  uniform float uTime;
  uniform float uShow;
  uniform float uDash;
  uniform float uDir;
  varying vec2 vP;
  void main(){
    float ang = atan(vP.y, vP.x);
    float dash = smoothstep(.25, .6, .5 + .5 * sin(ang * uDash + uTime * uDir));
    float fade = .35 + .65 * (.5 + .5 * sin(ang * 2. - uTime * .7 * uDir));
    gl_FragColor = vec4(vec3(.92, .93, .95) * (.4 + .8 * dash), uShow * dash * fade * .7);
  }
`;

/* ─────────────── bean dissolve (injected into MeshPhysicalMaterial) ─────────────── */
export function patchBeanMaterial(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uniforms.uDissolve;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float uDissolve;\nvarying vec3 vObj;\n${NOISE}`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         float dn = vnoise(vObj * 3.4) * .55 + vnoise(vObj * 9.) * .3 + vnoise(vObj * 22.) * .15;
         float dth = uDissolve * 1.12 - .06;
         if (dn < dth) discard;`
      )
      .replace(
        '#include <opaque_fragment>',
        `float rim = 1. - smoothstep(0., .035, dn - dth);
         outgoingLight += rim * vec3(.9, .9, .92) * 1.5 * step(.001, uDissolve);
         #include <opaque_fragment>`
      );
  };
}
