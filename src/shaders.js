export const vertexShader = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const fragmentShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_glassCenter;
uniform vec2 u_glassSize;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_radius;
uniform float u_refraction;
uniform float u_blur;
uniform float u_chromatic;
uniform float u_lighting;
uniform float u_tint;

float roundedBoxSDF(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 background(vec2 uv) {
  vec2 p = uv;
  float t = u_time * 0.035;
  vec3 base = mix(vec3(0.025, 0.047, 0.075), vec3(0.075, 0.095, 0.135), uv.y);
  float glowA = exp(-dot(p - vec2(0.76 + sin(t)*.03, .72), p - vec2(.76 + sin(t)*.03, .72)) * 8.0);
  float glowB = exp(-dot(p - vec2(.42, .16 + cos(t*.7)*.03), p - vec2(.42, .16 + cos(t*.7)*.03)) * 12.0);
  float glowC = exp(-dot(p - vec2(.93, .31), p - vec2(.93, .31)) * 22.0);
  base += glowA * vec3(.13, .31, .48);
  base += glowB * vec3(.28, .13, .09);
  base += glowC * vec3(.22, .19, .38);

  vec2 grid = fract(uv * vec2(13.0, 8.0)) - .5;
  vec2 cell = floor(uv * vec2(13.0, 8.0));
  float seed = hash21(cell);
  float points = smoothstep(.035, .0, length(grid)) * step(.76, seed);
  base += points * vec3(.28, .42, .58);

  float band = smoothstep(.012, .0, abs(uv.y - (.3 + .06*sin(uv.x*9. + t*2.))));
  base += band * vec3(.10, .13, .18);
  return base;
}

void main() {
  vec2 uv = v_uv;
  vec2 px = uv * u_resolution;
  vec2 local = px - u_glassCenter;
  float sdf = roundedBoxSDF(local, u_glassSize * .5, u_radius);
  float inside = 1.0 - smoothstep(-1.0, 1.0, sdf);
  vec3 color = background(uv);

  if (inside > 0.0) {
    float edgeDistance = clamp(-sdf / max(min(u_glassSize.x, u_glassSize.y) * .24, 1.0), 0.0, 1.0);
    float edge = pow(1.0 - edgeDistance, 2.25);
    vec2 dir = normalize(local + vec2(.001));
    float lens = edge * edge * u_refraction;
    vec2 warped = uv - dir * lens / u_resolution;
    warped += vec2(sin(local.y*.022 + u_time*.5), cos(local.x*.018 - u_time*.4)) * .5 * u_refraction / u_resolution;

    vec2 blurStep = vec2(u_blur) / u_resolution;
    vec3 glassColor = background(warped) * .28;
    glassColor += background(warped + vec2( blurStep.x, 0.0)) * .12;
    glassColor += background(warped + vec2(-blurStep.x, 0.0)) * .12;
    glassColor += background(warped + vec2(0.0,  blurStep.y)) * .12;
    glassColor += background(warped + vec2(0.0, -blurStep.y)) * .12;
    glassColor += background(warped + blurStep) * .06;
    glassColor += background(warped - blurStep) * .06;
    glassColor += background(warped + vec2(blurStep.x, -blurStep.y)) * .06;
    glassColor += background(warped + vec2(-blurStep.x, blurStep.y)) * .06;

    float ca = u_chromatic * edge / u_resolution.x;
    glassColor.r = background(warped + dir * ca).r;
    glassColor.b = background(warped - dir * ca).b;

    vec2 lightDir = normalize((u_pointer - u_glassCenter) / u_resolution + vec2(-.15, .22));
    float facing = max(dot(dir, lightDir), 0.0);
    float highlight = pow(facing, 7.0) * pow(edge, 1.35) * u_lighting;
    float rim = pow(edge, 5.0) * (.12 + .28 * u_lighting);
    float innerShadow = pow(edge, 2.2) * max(dot(dir, -lightDir), 0.0) * .16;

    glassColor = mix(glassColor, vec3(.72, .84, .95), u_tint * .13);
    glassColor += vec3(.72, .89, 1.0) * highlight;
    glassColor += vec3(.55, .71, .88) * rim;
    glassColor -= innerShadow;
    color = mix(color, glassColor, inside * (.88 + u_tint*.08));
  }

  float vignette = 1.0 - smoothstep(.48, .88, distance(uv, vec2(.58,.5))) * .26;
  color *= vignette;
  color += (hash21(gl_FragCoord.xy + u_time) - .5) / 255.0;
  outColor = vec4(pow(color, vec3(.93)), 1.0);
}`;
