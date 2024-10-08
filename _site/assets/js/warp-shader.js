window.onload = function () {
    const canvas = document.getElementById("c");
  
    let width = 800;
    let height = 600;
  
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    renderer.setSize(width, height, 2);
  
    renderTarget = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    renderTarget.setSize(width, height, 2);
  
    window.addEventListener("resize", function (e) {
      renderer.setSize(width, height, 2);
      renderTarget.setSize(width, height, 2);
    });
  
    const clock = new THREE.Clock();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
    const s1 = new THREE.Scene();
  
    const q1 = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2, 2, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          Time: { value: 0.0 },
          Resolution: { type: "v2", value: new THREE.Vector2() },
        },
        vertexShader: `
              varying vec2 UV;
  
              void main() {
                  UV = uv;
                  gl_Position = vec4(position, 1.0);    
              }
            `,
        fragmentShader: `
              varying vec2 UV;
  
              uniform float Time;
              
              uniform vec2 Resolution;
  
              float noise(vec2 x) {
                  return fract(sin(dot(x / 500.0, vec2(12.9898, 78.233))) * 43758.5453);
              }
  
              void main() {
                  vec3 r = vec3(2.0 * (gl_FragCoord.xy - Resolution * 0.5) / Resolution, (sin(Time * 0.01) * 0.5 + 0.5) * 0.6 + 0.4);
  
                  float o = Time * 0.08;
  
                  vec3 c = vec3(0.0);
                  vec3 s = r / max(abs(r.x), abs(r.y));
  
                  vec3 p = 2.0 * s + 0.1;
                  for (int i = 0; i < 20; ++i, p += s) {
                      vec3 d = vec3(30.0 * fract(noise(round(p.xy)) - o) - p.z);
                      c += max(vec3(0.0), vec3(0.9) - abs(d * vec3(0.76))) * d;
                  }
  
                  gl_FragColor = vec4(c, 1.0);
              }      
            `,
      })
    );
    s1.add(q1);
  
    const s2 = new THREE.Scene();
  
    const q2 = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2, 2, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: {
          Time: { value: 0.0 },
          Resolution: { type: "v2", value: new THREE.Vector2() },
          Tex: { value: renderTarget.texture },
        },
        vertexShader: `
              varying vec2 UV;
  
              void main() {
                  UV = uv;
                  gl_Position = vec4(position, 1.0);    
              }
            `,
        fragmentShader: `
              varying vec2 UV;
  
              uniform float Time;
  
              uniform sampler2D Tex;
              
              const vec2 randConst = vec2(12.9898, 78.233);
  
              const float randMultiplier = 43758.5453;
              const float smoothstepWidth = 0.02;
              const float textureOffsets[3] = float[](0.010, 0.005, 0.000);
  
              void main() {
                  vec2 uv = UV;
  
                  float smoothstepRange = 1.0 / 15.0;
                  float smoothstepStart = smoothstepRange * (floor(Time * 0.5 / smoothstepRange));
                  float smoothstepEnd = smoothstepStart + smoothstepRange;
                  float smoothstepValue = smoothstep(smoothstepStart, smoothstepEnd, uv.y);
  
                  float o = 0.01 * sin(1.0 - tan(Time * 0.005));
                  
                  uv.x += (smoothstepValue * o) - ((1.0 - smoothstepValue) * o);
                  uv.x += fract(sin(dot(vec2(Time * 0.00001, floor(uv.y * 200.0) / 200.0), randConst)) * randMultiplier) * 0.005;
  
                  vec4 texValue = vec4(0.0, 0.0, 0.0, 1.0);
                  for (int i = 0; i < 3; ++i) {
                      texValue[i] = texture(Tex, uv + vec2(textureOffsets[i], 0.0)).r;
                  }
                  texValue.w = 1.0;
  
                  gl_FragColor = texValue;
              }
            `,
      })
    );
    s2.add(q2);
  
    function animate() {
      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
  
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
  
      var delta = clock.getDelta();
  
      q1.material.uniforms["Time"].value += delta;
      q1.material.uniforms["Resolution"].value.x = renderer.domElement.width;
      q1.material.uniforms["Resolution"].value.y = renderer.domElement.height;
  
      q2.material.uniforms["Time"].value += delta;
      q2.material.uniforms["Resolution"].value.x = renderer.domElement.width;
      q2.material.uniforms["Resolution"].value.y = renderer.domElement.height;
  
      requestAnimationFrame(animate);
  
      renderer.setRenderTarget(renderTarget);
      renderer.render(s1, camera);
  
      renderer.setRenderTarget(null);
      renderer.render(s2, camera);
    }
    animate();
  };