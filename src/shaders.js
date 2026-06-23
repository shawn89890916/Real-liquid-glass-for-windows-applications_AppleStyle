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
uniform sampler2D u_backdrop;
uniform float u_hasBackdrop;
uniform vec2 u_velocity;
uniform float u_elasticity;

float sdSquircle(vec2 p, vec2 b, float n) {
  vec2 d = abs(p) / b;
  float dist = pow(pow(d.x, n) + pow(d.y, n), 1.0 / n);
  return (dist - 1.0) * min(b.x, b.y);
}

vec2 sdSquircleGrad(vec2 p, vec2 b, float n) {
  vec2 d = abs(p) / b;
  float sum = pow(d.x, n) + pow(d.y, n);
  if (sum < 0.0001) return vec2(0.0, 1.0);
  float sumPow = pow(sum, 1.0 / n - 1.0);
  vec2 grad = sign(p) * pow(d, vec2(n - 1.0)) / b * sumPow;
  float len = length(grad);
  return len > 0.0001 ? grad / len : vec2(0.0, 1.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 sampleBackdrop(vec2 uv) {
  vec2 texCoord = vec2(uv.x, 1.0 - uv.y);
  if (u_hasBackdrop > 0.5) {
    return texture(u_backdrop, texCoord).rgb;
  }
  vec2 p = uv;
  float t = u_time * 0.035;
  vec3 base = mix(vec3(0.025, 0.047, 0.075), vec3(0.075, 0.095, 0.135), uv.y);
  float glowA = exp(-dot(p - vec2(0.76 + sin(t)*.03, .72), p - vec2(.76 + sin(t)*.03, .72)) * 8.0);
  float glowB = exp(-dot(p - vec2(.42, .16 + cos(t*.7)*.03), p - vec2(.42, .16 + cos(t*.7)*.03)) * 12.0);
  base += glowA * vec3(.13, .31, .48);
  base += glowB * vec3(.28, .13, .09);
  vec2 grid = fract(uv * vec2(13.0, 8.0)) - .5;
  vec2 cell = floor(uv * vec2(13.0, 8.0));
  float seed = hash21(cell);
  float points = smoothstep(.035, .0, length(grid)) * step(.76, seed);
  base += points * vec3(.28, .42, .58);
  return base;
}

void main() {
  vec2 uv = v_uv;
  vec2 px = uv * u_resolution;
  vec2 local = px - u_glassCenter;

  float velMag = length(u_velocity);
  vec2 velDir = velMag > 0.001 ? u_velocity / velMag : vec2(0.0);
  vec2 deformedSize = u_glassSize * (1.0 + vec2(velDir.x, -velDir.y) * velMag * 0.0008);
  deformedSize = max(deformedSize, u_glassSize * 0.85);

  float n = 4.0;
  float sdf = sdSquircle(local, deformedSize * .5, n);
  float inside = 1.0 - smoothstep(-1.5, 1.5, sdf);

  if (inside < 0.001) {
    outColor = vec4(sampleBackdrop(uv), 1.0);
    return;
  }

  vec2 grad = sdSquircleGrad(local, deformedSize * .5, n);
  float bevelWidth = max(min(deformedSize.x, deformedSize.y) * 0.18, 1.0);
  float edgeDistance = clamp(-sdf / bevelWidth, 0.0, 1.0);
  float edge = pow(1.0 - edgeDistance, 2.0);

  vec2 dir = grad;
  float displacementIntensity = edge * edge * u_refraction;
  vec2 warped = uv - dir * displacementIntensity / u_resolution;

  // Elasticity effect based on mouse position
  vec2 delta = u_pointer - u_glassCenter;
  float centerDist = length(delta);
  float activationZone = min(deformedSize.x, deformedSize.y) * 2.0;
  float fadeIn = max(0.0, 1.0 - centerDist / activationZone);
  
  if (centerDist > 0.001 && fadeIn > 0.0) {
    vec2 normDelta = delta / centerDist;
    float stretch = min(centerDist / activationZone, 1.0) * u_elasticity * fadeIn;
    warped += dir * stretch * 0.5 / u_resolution;
  }

  // Chromatic aberration - separate RGB channels
  float ca = u_chromatic * edge / u_resolution.x;
  vec2 redOffset = dir * ca;
  vec2 blueOffset = dir * ca * 1.5;

  vec3 redChannel = sampleBackdrop(warped - redOffset);
  vec3 greenChannel = sampleBackdrop(warped);
  vec3 blueChannel = sampleBackdrop(warped + blueOffset);

  // Combine channels with screen blend for natural chromatic effect
  vec3 chromaticColor = vec3(0.0);
  chromaticColor.r = 1.0 - (1.0 - redChannel.r) * (1.0 - greenChannel.r) * (1.0 - blueChannel.r);
  chromaticColor.g = 1.0 - (1.0 - redChannel.g) * (1.0 - greenChannel.g) * (1.0 - blueChannel.g);
  chromaticColor.b = 1.0 - (1.0 - redChannel.b) * (1.0 - greenChannel.b) * (1.0 - blueChannel.b);

  // Frosted glass blur
  vec2 blurStep = vec2(u_blur) / u_resolution;
  vec3 glassColor = chromaticColor * 0.28;
  glassColor += sampleBackdrop(warped + vec2(blurStep.x, 0.0)) * 0.12;
  glassColor += sampleBackdrop(warped + vec2(-blurStep.x, 0.0)) * 0.12;
  glassColor += sampleBackdrop(warped + vec2(0.0, blurStep.y)) * 0.12;
  glassColor += sampleBackdrop(warped + vec2(0.0, -blurStep.y)) * 0.12;
  glassColor += sampleBackdrop(warped + blurStep) * 0.06;
  glassColor += sampleBackdrop(warped - blurStep) * 0.06;
  glassColor += sampleBackdrop(warped + vec2(blurStep.x, -blurStep.y)) * 0.06;
  glassColor += sampleBackdrop(warped + vec2(-blurStep.x, blurStep.y)) * 0.06;

  // Specular highlights
  vec2 lightDir = normalize((u_pointer - u_glassCenter) / u_resolution + vec2(-0.15, 0.22));
  float facing = max(dot(dir, lightDir), 0.0);
  float highlight = pow(facing, 7.0) * pow(edge, 1.35) * u_lighting;
  float rim = pow(edge, 5.0) * (0.12 + 0.28 * u_lighting);
  float innerShadow = pow(edge, 2.2) * max(dot(dir, -lightDir), 0.0) * 0.16;

  glassColor = mix(glassColor, vec3(0.72, 0.84, 0.95), u_tint * 0.13);
  glassColor += vec3(0.72, 0.89, 1.0) * highlight;
  glassColor += vec3(0.55, 0.71, 0.88) * rim;
  glassColor -= innerShadow;

  // Center stays sharp, edges get glass effect
  vec3 color = mix(sampleBackdrop(uv), glassColor, inside * (0.88 + u_tint * 0.08));

  float vignette = 1.0 - smoothstep(0.48, 0.88, distance(uv, vec2(0.58, 0.5))) * 0.26;
  color *= vignette;
  color += (hash21(gl_FragCoord.xy + u_time) - 0.5) / 255.0;
  outColor = vec4(pow(color, vec3(0.93)), 1.0);
}`;