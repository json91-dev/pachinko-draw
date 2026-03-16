const VS = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FS = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_holePos;
  uniform float u_intensity;
  uniform vec2 u_resolution;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.y = 1.0 - uv.y;

    vec2 toHole = uv - u_holePos;
    float dist = length(toHole);
    float angle = atan(toHole.y, toHole.x);

    float spiral1 = sin(angle * 4.0 - u_time * 3.0 + u_intensity * 3.0 / max(dist, 0.01));
    float spiral2 = sin(angle * 7.0 - u_time * 5.0 + u_intensity * 2.0 / max(dist, 0.01));

    float glow = smoothstep(0.35, 0.0, dist) * u_intensity;
    float innerGlow = smoothstep(0.07, 0.0, dist) * u_intensity;
    float dark = smoothstep(0.045, 0.005, dist);

    vec3 col = vec3(0.35, 0.0, 0.65) * glow * (spiral1 * 0.5 + 0.5);
    col += vec3(0.7, 0.2, 1.0) * glow * (spiral2 * 0.5 + 0.5) * 0.6;
    col += vec3(1.0, 0.6, 1.0) * innerGlow;

    float alpha = clamp(glow * 0.75 + innerGlow + dark * 0.7, 0.0, 0.88) * u_intensity;

    gl_FragColor = vec4(col * (1.0 - dark * 0.9), alpha);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}

export class BlackholeShader {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private uTime: WebGLUniformLocation;
  private uHolePos: WebGLUniformLocation;
  private uIntensity: WebGLUniformLocation;
  private uResolution: WebGLUniformLocation;
  public active = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:fixed;top:0;left:0;pointer-events:none;z-index:5;';
    document.body.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
    })!;
    this.gl = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    this.program = prog;

    const pos = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

    const loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.uTime = gl.getUniformLocation(prog, 'u_time')!;
    this.uHolePos = gl.getUniformLocation(prog, 'u_holePos')!;
    this.uIntensity = gl.getUniformLocation(prog, 'u_intensity')!;
    this.uResolution = gl.getUniformLocation(prog, 'u_resolution')!;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  render(time: number, holeX: number, holeY: number, screenW: number, screenH: number, intensity: number) {
    const { gl } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform1f(this.uTime, time);
    gl.uniform2f(this.uHolePos, holeX / screenW, 1.0 - holeY / screenH);
    gl.uniform1f(this.uIntensity, intensity);
    gl.uniform2f(this.uResolution, screenW, screenH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    this.canvas.remove();
  }
}
