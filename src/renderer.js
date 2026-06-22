import { vertexShader, fragmentShader } from './shaders.js';

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

export class GlassRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL2 unavailable');
    this.values = { refraction: 32, blur: 4, chromatic: 10, lighting: 0.9, tint: 0.35, radius: 78 };
    this.pointer = { x: innerWidth * .76, y: innerHeight * .25 };
    this.glass = { x: innerWidth * .68, y: innerHeight * .57, width: 650, height: 394 };
    this.start = performance.now();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setup();
    this.resize();
  }

  setup() {
    const gl = this.gl;
    this.program = gl.createProgram();
    gl.attachShader(this.program, compile(gl, gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(this.program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = {};
    ['resolution','glassCenter','glassSize','pointer','time','radius','refraction','blur','chromatic','lighting','tint'].forEach(name => {
      this.uniforms[name] = gl.getUniformLocation(this.program, `u_${name}`);
    });
  }

  resize() {
    const dpr = Math.min(devicePixelRatio, 1.75);
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.dpr = dpr;
  }

  setGlass(rect) {
    this.glass = {
      x: (rect.left + rect.width / 2) * this.dpr,
      y: (innerHeight - rect.top - rect.height / 2) * this.dpr,
      width: rect.width * this.dpr,
      height: rect.height * this.dpr
    };
  }

  render = () => {
    const gl = this.gl;
    const u = this.uniforms;
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.glassCenter, this.glass.x, this.glass.y);
    gl.uniform2f(u.glassSize, this.glass.width, this.glass.height);
    gl.uniform2f(u.pointer, this.pointer.x * this.dpr, (innerHeight - this.pointer.y) * this.dpr);
    gl.uniform1f(u.time, this.reducedMotion ? 0 : (performance.now() - this.start) / 1000);
    gl.uniform1f(u.radius, this.values.radius * this.dpr);
    gl.uniform1f(u.refraction, this.values.refraction * this.dpr);
    gl.uniform1f(u.blur, this.values.blur * this.dpr);
    gl.uniform1f(u.chromatic, this.values.chromatic * this.dpr);
    gl.uniform1f(u.lighting, this.values.lighting);
    gl.uniform1f(u.tint, this.values.tint);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(this.render);
  };
}
