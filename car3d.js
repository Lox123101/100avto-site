/* Car3D — компактный WebGL2-рендер для разборной модели автомобиля.
   Формат данных: car.json (материалы, диапазоны отрисовки, детали) + car.bin (вершины, нормали, UV, индексы). */
(function () {
  'use strict';

  var VS = '#version 300 es\n' +
    'layout(location=0) in vec3 aP; layout(location=1) in vec4 aN; layout(location=2) in vec2 aUV;\n' +
    'uniform mat4 uVP; uniform vec3 uOff;\n' +
    'out vec3 vW; out vec3 vN; out vec2 vUV;\n' +
    'void main(){ vec3 w=aP+uOff; vW=w; vN=aN.xyz; vUV=aUV; gl_Position=uVP*vec4(w,1.0); }';

  var FS = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vW; in vec3 vN; in vec2 vUV; out vec4 o;\n' +
    'uniform vec3 uCam; uniform vec4 uCol; uniform float uM; uniform float uR; uniform sampler2D uT; uniform float uHasT;\n' +
    'uniform vec3 uE; uniform float uCC; uniform float uBlend; uniform vec4 uDbg; uniform float uGlow;\n' +
    'float band(float x,float c,float h,float w){ return smoothstep(c-h-w,c-h+w,x)*(1.0-smoothstep(c+h-w,c+h+w,x)); }\n' +
    /* процедурная «студия»: тёмный зал, голубой купол, световые полосы и потолочный софтбокс */
    'vec3 env(vec3 d,float r){\n' +
    '  float w=mix(0.012,0.45,r); float up=d.y;\n' +
    '  vec3 c=mix(vec3(0.035,0.045,0.07),vec3(0.16,0.27,0.48),smoothstep(-0.1,1.0,up));\n' +
    '  c=mix(c,vec3(0.34,0.40,0.50),smoothstep(0.02,-0.45,up));\n' +
    '  c+=vec3(1.0,0.98,0.95)*2.6*band(up,0.20,0.055,w)*(0.55+0.45*smoothstep(-0.2,0.9,abs(d.z)));\n' +
    '  c+=vec3(0.55,0.75,1.0)*1.5*band(up,0.44,0.03,w);\n' +
    '  float top=smoothstep(0.80-w,0.88+w,up)*(1.0-smoothstep(0.30-w,0.42+w,abs(d.z)));\n' +
    '  c+=vec3(1.0)*4.0*top;\n' +
    '  c+=vec3(1.0,0.55,0.2)*0.9*band(up,-0.12,0.03,w)*smoothstep(0.3,1.0,-d.x);\n' +
    '  return c*mix(1.0,0.55,r);\n' +
    '}\n' +
    'void main(){\n' +
    '  vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N;\n' +
    '  vec3 V=normalize(uCam-vW); float nv=max(dot(N,V),0.0);\n' +
    '  vec3 L=normalize(vec3(0.45,0.85,0.35)); float nl=max(dot(N,L),0.0);\n' +
    '  if(uDbg.a>0.5){ o=vec4(uDbg.rgb*(0.35+0.65*nl),1.0); return; }\n' +
    '  vec4 t=uHasT>0.5?texture(uT,vUV):vec4(1.0); vec3 base=uCol.rgb*pow(t.rgb,vec3(2.2)); float a=uCol.a*t.a;\n' +
    '  vec3 F0=mix(vec3(0.04),base,uM); float fr=pow(1.0-nv,5.0); vec3 F=F0+(1.0-F0)*fr;\n' +
    '  vec3 Rv=reflect(-V,N);\n' +
    '  float amb=mix(0.28,1.0,N.y*0.5+0.5);\n' +
    '  vec3 c=base*(1.0-uM)*(amb*0.55+nl*0.95);\n' +
    '  c+=env(Rv,uR)*F*mix(1.0,0.35,uR);\n' +
    '  c+=env(Rv,0.02)*(0.04+0.96*fr)*uCC*0.9;\n' +
    '  c+=uE*3.0;\n' +
    '  c+=vec3(1.0,0.45,0.1)*uGlow*(0.25+0.75*fr);\n' +
    '  c=c*(2.51*c+0.03)/(c*(2.43*c+0.59)+0.14);\n' +
    '  c=pow(clamp(c,0.0,1.0),vec3(1.0/2.2));\n' +
    '  float al=uBlend>0.5?clamp(mix(a,1.0,max(fr,0.08))+0.0,0.0,1.0):1.0;\n' +
    '  o=vec4(c,al);\n' +
    '}';

  var SVS = '#version 300 es\nlayout(location=0) in vec2 aP; uniform mat4 uVP; uniform vec4 uRect; out vec2 vq;\n' +
    'void main(){ vq=aP; gl_Position=uVP*vec4(uRect.x+aP.x*uRect.z,0.012,uRect.y+aP.y*uRect.w,1.0); }';
  var SFS = '#version 300 es\nprecision highp float; in vec2 vq; out vec4 o; uniform float uA;\n' +
    'void main(){ float d=length(vq); float a=smoothstep(1.0,0.25,d); o=vec4(0.03,0.09,0.2,a*a*uA); }';

  function sh(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(gl, vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
  function unis(gl, p, names) { var u = {}; names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); }); return u; }

  function persp(fovy, asp, n, f) { var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
  function lookAt(e, c) {
    var z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], l = Math.hypot(z[0], z[1], z[2]); z = [z[0] / l, z[1] / l, z[2] / l];
    var x = [z[2], 0, -z[0]]; l = Math.hypot(x[0], x[2]); x = [x[0] / l, 0, x[2] / l];
    var y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    var m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]);
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]);
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]);
    m[15] = 1; return m;
  }
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }

  function Car3D(canvas) {
    this.canvas = canvas;
    var gl = this.gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 недоступен');
    this.p = prog(gl, VS, FS);
    this.u = unis(gl, this.p, ['uVP', 'uOff', 'uCam', 'uCol', 'uM', 'uR', 'uT', 'uHasT', 'uE', 'uCC', 'uBlend', 'uDbg', 'uGlow']);
    this.sp = prog(gl, SVS, SFS); this.su = unis(gl, this.sp, ['uVP', 'uRect', 'uA']);
    this.cam = { yaw: 0.7, pitch: 0.3, dist: 9, target: [0, 0.6, 0], fov: 28 * Math.PI / 180 };
    this.offsets = []; this.glow = []; this.shadow = 1; this.debug = null; this.ready = false;
  }

  Car3D.prototype.load = function (base) {
    var self = this;
    return Promise.all([fetch(base + 'car.json').then(function (r) { return r.json(); }), fetch(base + 'car.bin').then(function (r) { return r.arrayBuffer(); })]).then(function (res) { self.setData(res[0], res[1], base); return res[0]; });
  };

  Car3D.prototype.setData = function (json, buf, base) {
    var self = this, gl = this.gl;
    {
      var d = self.data = json, nv = d.nv, ni = d.ni;
      var vao = self.vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      function vb(loc, arr, size, type, norm) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); }
      var o = 0;
      vb(0, new Float32Array(buf, o, nv * 3), 3, gl.FLOAT, false); o += nv * 12;
      vb(1, new Int8Array(buf, o, nv * 4), 4, gl.BYTE, true); o += nv * 4;
      vb(2, new Float32Array(buf, o, nv * 2), 2, gl.FLOAT, false); o += nv * 8;
      var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(buf, o, ni), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      var q = self.qvao = gl.createVertexArray(); gl.bindVertexArray(q); vb(0, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2, gl.FLOAT, false); gl.bindVertexArray(null);
      self.offsets = d.insts.map(function () { return [0, 0, 0]; }); self.glow = d.insts.map(function () { return 0; });
      self.tex = d.tex.map(function (file) {
        var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
        var im = new Image();
        im.onload = function () {
          gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          self.pending--; self.requestRender();
        };
        im.onerror = function () { self.pending--; };
        self.pending = (self.pending || 0) + 1; im.src = file.indexOf('data:') === 0 ? file : base + file; return t;
      });
      self.ready = true; self.render();
    }
  };

  /* несколько запросов за кадр сливаются в одну отрисовку */
  Car3D.prototype.requestRender = function () {
    var self = this; if (this._raf) return;
    this._raf = requestAnimationFrame(function () { self._raf = 0; self.render(); });
  };

  Car3D.prototype.resize = function () {
    var c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
  };

  Car3D.prototype.matrices = function () {
    var c = this.cam, cp = Math.cos(c.pitch), eye = [c.target[0] + c.dist * cp * Math.cos(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.sin(c.yaw)];
    var asp = this.canvas.width / Math.max(this.canvas.height, 1), fov = c.fov;
    if (asp < 1.2) fov = 2 * Math.atan(Math.tan(c.fov / 2) * 1.2 / asp);   // на узких экранах держим ширину кадра
    this.eye = eye; this.vp = mul(persp(fov, asp, 0.3, 80), lookAt(eye, c.target)); return this.vp;
  };

  /* мировая точка → координаты в CSS-пикселях канваса */
  Car3D.prototype.project = function (p) {
    var m = this.vp, w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    var x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
    return [(x * 0.5 + 0.5) * this.canvas.clientWidth, (1 - (y * 0.5 + 0.5)) * this.canvas.clientHeight, w];
  };

  Car3D.prototype.render = function () {
    if (!this.ready) return;
    var gl = this.gl, d = this.data, u = this.u, self = this;
    this.resize(); var vp = this.matrices();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.shadow > 0.01 && !this.debug) {
      gl.disable(gl.DEPTH_TEST); gl.useProgram(this.sp); gl.uniformMatrix4fv(this.su.uVP, false, vp);
      gl.uniform4f(this.su.uRect, 0, 0, 3.3, 1.55); gl.uniform1f(this.su.uA, 0.55 * this.shadow);
      gl.bindVertexArray(this.qvao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.p); gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniform3fv(u.uCam, this.eye); gl.uniform1i(u.uT, 0); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.vao);
    function pass(blend) {
      gl.depthMask(!blend); gl.uniform1f(u.uBlend, blend ? 1 : 0);
      for (var k = 0; k < d.draws.length; k++) {
        var dr = d.draws[k], m = d.mats[dr.m]; if (!!m.blend !== blend) continue;
        var off = self.offsets[dr.i]; gl.uniform3f(u.uOff, off[0], off[1], off[2]);
        gl.uniform4fv(u.uCol, m.c); gl.uniform1f(u.uM, m.m); gl.uniform1f(u.uR, m.r); gl.uniform3fv(u.uE, m.e); gl.uniform1f(u.uCC, m.cc ? 1 : 0);
        gl.uniform1f(u.uGlow, self.glow[dr.i] || 0);
        if (m.t >= 0) { gl.bindTexture(gl.TEXTURE_2D, self.tex[m.t]); gl.uniform1f(u.uHasT, 1); } else gl.uniform1f(u.uHasT, 0);
        if (self.debug) { var c = self.debug(d.insts[dr.i], m); gl.uniform4f(u.uDbg, c[0], c[1], c[2], 1); } else gl.uniform4f(u.uDbg, 0, 0, 0, 0);
        gl.drawElements(gl.TRIANGLES, dr.n, gl.UNSIGNED_INT, dr.o * 4);
      }
    }
    pass(false); pass(true); gl.depthMask(true);
  };

  window.Car3D = Car3D;
})();
