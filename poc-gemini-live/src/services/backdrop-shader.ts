/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const vs = `precision highp float;

in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fs = `precision highp float;

out vec4 fragmentColor;

uniform vec2 resolution;
uniform float rand;

void main() {
  float aspectRatio = resolution.x / resolution.y; 
  vec2 vUv = gl_FragCoord.xy / resolution;
  float noise = (fract(sin(dot(vUv, vec2(12.9898 + rand,78.233)*2.0)) * 43758.5453));

  vUv -= .5;
  vUv.x *= aspectRatio;

  // Gradiente médico suave - do branco para azul claro hospitalar
  float factor = 2.5;  // Gradiente mais suave
  float d = factor * length(vUv);
  
  // Cores médicas: branco para azul claro
  vec3 from = vec3(248., 251., 255.) / 255.;  // Branco médico (#f8fbff)
  vec3 to = vec3(227., 242., 253.) / 255.;    // Azul hospitalar claro (#e3f2fd)

  fragmentColor = vec4(mix(from, to, d) + .002 * noise, 1.);  // Menos ruído
}
`;

export {fs, vs};
