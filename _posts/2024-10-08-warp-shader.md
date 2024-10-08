---
layout: post
title: Warp shader
description: A post describing a shader effect.
summary: A post describing a shader effect
tags: [shaders]
---

The previous version of this website featured a background that aligned with its retro aesthetic, created using a multi-pass GLSL shader.

The effect can be seen below.

<div class="shader">
  <script type="text/javascript" src="/assets/js/three.min.js"></script>
  <canvas id="c"></canvas>
  <script type="text/javascript" src="/assets/js/warp-shader.js"></script>
</div>

Two shaders are used to create the effect: the first generates a “warp” effect by stepping through a noise function, while the second is a post-processing shader that adds jitter and chromatic aberration. This effect utilizes two render passes, with the “warp” shader rendering to a render target and the post-processing shader rendering to the default frame buffer using the previously generated render target.

## Warp effect

```c
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
```

## Post-processing effect

```c
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
```